package storage

const (
	PackageName    = "code-storage-go-sdk"
	PackageVersion = "1.16.1"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
