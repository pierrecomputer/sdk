package storage

const (
	PackageName    = "code-storage-go-sdk"
	PackageVersion = "1.16.0"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
