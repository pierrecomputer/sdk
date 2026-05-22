package storage

const (
	PackageName    = "code-storage-go-sdk"
	PackageVersion = "0.8.0"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
