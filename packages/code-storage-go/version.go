package storage

const (
	PackageName = "code-storage-go-sdk"
	// PackageVersion is set from .version by scripts/sync_versions.py.
	PackageVersion = "1.18.0-beta.0"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
