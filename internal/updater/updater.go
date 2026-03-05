package updater

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const releasesURL = "https://api.github.com/repos/sneiko/kafkalet/releases/latest"

// Release holds information about a GitHub release.
type Release struct {
	TagName string `json:"tag_name"`
	Name    string `json:"name"`
	HTMLURL string `json:"html_url"`
	Body    string `json:"body"`
}

// CheckLatest checks the GitHub releases API and returns a Release if a newer
// version is available, or nil if the current version is up to date.
// Returns an error only on network/parse failures.
func CheckLatest(currentVersion string) (*Release, error) {
	if currentVersion == "dev" {
		return nil, nil
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(releasesURL)
	if err != nil {
		return nil, fmt.Errorf("fetch latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github API returned %d", resp.StatusCode)
	}

	var rel Release
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("decode release: %w", err)
	}

	if isNewer(rel.TagName, currentVersion) {
		return &rel, nil
	}
	return nil, nil
}

// isNewer returns true if remote version is strictly greater than local.
// Both versions may optionally start with "v".
func isNewer(remote, local string) bool {
	rv := parseVersion(remote)
	lv := parseVersion(local)
	if rv == nil || lv == nil {
		return false
	}
	for i := 0; i < 3; i++ {
		if rv[i] > lv[i] {
			return true
		}
		if rv[i] < lv[i] {
			return false
		}
	}
	return false
}

// parseVersion parses "v1.2.3" or "1.2.3" into [major, minor, patch].
// Returns nil if the format is invalid.
func parseVersion(s string) []int {
	s = strings.TrimPrefix(s, "v")
	parts := strings.SplitN(s, ".", 3)
	if len(parts) != 3 {
		return nil
	}
	nums := make([]int, 3)
	for i, p := range parts {
		// Strip anything after a hyphen (e.g. "1.2.3-beta" → "1.2.3")
		if idx := strings.IndexByte(p, '-'); idx >= 0 {
			p = p[:idx]
		}
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil
		}
		nums[i] = n
	}
	return nums
}
