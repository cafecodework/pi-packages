package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/cafecodework/pi-packages/packages/pi-cafe-space/relay/internal/config"
	"github.com/cafecodework/pi-packages/packages/pi-cafe-space/relay/internal/service"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

// This candidate entry point is not used by the existing package launcher.
// R08 wires collaboration; production embedded Web assets arrive in R16.
func main() {
	env := map[string]string{}
	for _, key := range []string{"PI_COLLAB_HOST", "PI_COLLAB_PORT", "PI_COLLAB_HOST_TOKEN", "PI_COLLAB_CLIENT_TOKEN", "PI_COLLAB_ALLOWED_ORIGINS"} {
		if v, ok := os.LookupEnv(key); ok {
			env[key] = v
		}
	}
	cfg, err := config.Parse(env)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	fmt.Fprintln(os.Stderr, "Relay candidate: Web assets are not built yet")
	if err := run(ctx, cfg); err != nil {
		fmt.Fprintln(os.Stderr, "Relay listener failed:", err)
		os.Exit(1)
	}
}
func run(ctx context.Context, cfg config.Config) error {
	server, err := service.New(cfg, service.Options{})
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)))
	if err != nil {
		_ = server.Close(context.Background())
		return err
	}
	done := make(chan error, 1)
	go func() { done <- server.Serve(listener) }()
	select {
	case err := <-done:
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Close(shutdown)
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		err := server.Close(shutdown)
		serveErr := <-done
		if err != nil {
			return err
		}
		if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			return serveErr
		}
		return nil
	}
}
