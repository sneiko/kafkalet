package updater

import (
	"testing"
)

func TestParseVersion(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []int
	}{
		{name: "with v prefix", in: "v1.2.3", want: []int{1, 2, 3}},
		{name: "without v prefix", in: "1.2.3", want: []int{1, 2, 3}},
		{name: "zeros", in: "v0.0.0", want: []int{0, 0, 0}},
		{name: "large numbers", in: "v10.20.30", want: []int{10, 20, 30}},
		{name: "beta suffix", in: "v1.0.0-beta", want: []int{1, 0, 0}},
		{name: "rc suffix on patch", in: "v2.1.3-rc1", want: []int{2, 1, 3}},
		{name: "empty string", in: "", want: nil},
		{name: "dev", in: "dev", want: nil},
		{name: "alpha only", in: "abc", want: nil},
		{name: "two components", in: "1.2", want: nil},
		{name: "single number", in: "1", want: nil},
		{name: "non-numeric major", in: "x.2.3", want: nil},
		{name: "non-numeric minor", in: "1.y.3", want: nil},
		{name: "non-numeric patch", in: "1.2.z", want: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseVersion(tt.in)
			if tt.want == nil {
				if got != nil {
					t.Errorf("parseVersion(%q) = %v, want nil", tt.in, got)
				}
				return
			}
			if got == nil {
				t.Fatalf("parseVersion(%q) = nil, want %v", tt.in, tt.want)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("parseVersion(%q) length = %d, want %d", tt.in, len(got), len(tt.want))
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Errorf("parseVersion(%q)[%d] = %d, want %d", tt.in, i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestIsNewer(t *testing.T) {
	tests := []struct {
		name   string
		remote string
		local  string
		want   bool
	}{
		// Major version differences
		{name: "major greater", remote: "v2.0.0", local: "v1.0.0", want: true},
		{name: "major less", remote: "v1.0.0", local: "v2.0.0", want: false},
		{name: "major equal", remote: "v1.0.0", local: "v1.0.0", want: false},

		// Minor version differences
		{name: "minor greater", remote: "v1.2.0", local: "v1.1.0", want: true},
		{name: "minor less", remote: "v1.1.0", local: "v1.2.0", want: false},
		{name: "minor equal", remote: "v1.2.0", local: "v1.2.0", want: false},

		// Patch version differences
		{name: "patch greater", remote: "v1.0.2", local: "v1.0.1", want: true},
		{name: "patch less", remote: "v1.0.1", local: "v1.0.2", want: false},
		{name: "patch equal", remote: "v1.0.1", local: "v1.0.1", want: false},

		// Mixed component comparison
		{name: "higher major wins over higher minor", remote: "v2.0.0", local: "v1.9.9", want: true},
		{name: "higher minor wins over higher patch", remote: "v1.2.0", local: "v1.1.9", want: true},

		// Without v prefix
		{name: "no v prefix both", remote: "2.0.0", local: "1.0.0", want: true},
		{name: "mixed v prefix", remote: "v2.0.0", local: "1.0.0", want: true},

		// Invalid versions
		{name: "invalid remote", remote: "dev", local: "v1.0.0", want: false},
		{name: "invalid local", remote: "v1.0.0", local: "dev", want: false},
		{name: "both invalid", remote: "abc", local: "xyz", want: false},
		{name: "empty remote", remote: "", local: "v1.0.0", want: false},
		{name: "empty local", remote: "v1.0.0", local: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isNewer(tt.remote, tt.local)
			if got != tt.want {
				t.Errorf("isNewer(%q, %q) = %v, want %v", tt.remote, tt.local, got, tt.want)
			}
		})
	}
}
