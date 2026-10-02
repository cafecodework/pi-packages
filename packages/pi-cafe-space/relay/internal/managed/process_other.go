//go:build !windows

package managed

import (
	"errors"
	"os/exec"
	"path/filepath"
)

func resolvedPath(path string) (string, error) { return filepath.EvalSymlinks(path) }
func lockRegistry(path string) (func(), error) {
	return nil, errors.New("managed Pi is currently Windows-only")
}
func prepareProcess(cmd *exec.Cmd) {}
func ownProcess(cmd *exec.Cmd) (func(), error) {
	return nil, errors.New("managed Pi process ownership is currently Windows-only")
}
