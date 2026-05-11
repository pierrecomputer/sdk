package storage

const (
	PackageName    = "code-storage-go-sdk"
	PackageVersion = "0.6.0"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
