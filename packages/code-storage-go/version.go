package storage

const (
	PackageName    = "code-storage-go-sdk"
	PackageVersion = "0.4.2"
)

func userAgent() string {
	return PackageName + "/" + PackageVersion
}
