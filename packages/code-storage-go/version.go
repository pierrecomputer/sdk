package storage

const (
	PackageName    = "code-storage-go-sdk"
	PackageVersion = "1.15.0"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
