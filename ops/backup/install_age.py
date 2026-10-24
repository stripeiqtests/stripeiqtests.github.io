"""Install the reviewed official age test tools into an explicit local directory.

No system install, PATH change or external Python dependency. Digests are the
v1.3.2 release asset SHA-256 values published by FiloSottile/age, checked before
opening the archive. Only the two named executable files can be extracted.
"""
import hashlib
import io
from pathlib import Path
import platform
import sys
import tarfile
import urllib.request
import zipfile

ASSETS = {
    "Windows": ("windows-amd64.zip", "f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7"),
    "Linux": ("linux-amd64.tar.gz", "cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10"),
}


def install(directory):
    system = platform.system()
    if system not in ASSETS or platform.machine().lower() not in {"amd64", "x86_64"}:
        raise RuntimeError("Backup tests currently support Linux/Windows x86-64")
    destination = Path(directory).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    suffix, digest = ASSETS[system]
    request = urllib.request.Request("https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-" + suffix,
                                     headers={"User-Agent": "inner-code-backup-tests/1.0"})
    cache = destination / ("age-v1.3.2-" + suffix)
    if cache.exists():
        data = cache.read_bytes()
    else:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(32 * 1024**2)
    if hashlib.sha256(data).hexdigest() != digest:
        raise RuntimeError("Official age release SHA-256 mismatch")
    if not cache.exists():
        cache.write_bytes(data)
    names = ["age/age", "age/age-keygen"]
    if system == "Windows":
        names = [name + ".exe" for name in names]
    if system == "Windows":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            payloads = [(Path(name).name, archive.read(name)) for name in names]
    else:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            payloads = []
            for name in names:
                entry = archive.getmember(name)
                if not entry.isfile() or entry.size > 16 * 1024**2:
                    raise RuntimeError("Invalid official age executable member")
                payloads.append((Path(name).name, archive.extractfile(entry).read()))
    for name, content in payloads:
        target = destination / name
        target.write_bytes(content)
        target.chmod(0o700)
    return destination


if __name__ == "__main__":
    print(install(sys.argv[1]))
