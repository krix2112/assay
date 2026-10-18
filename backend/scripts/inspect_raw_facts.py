"""Script to inspect data/raw files and sidecars."""

import json
from pathlib import Path

raw_dir = Path("../data/raw")

data_files = [p for p in raw_dir.iterdir() if p.is_file() and not p.name.endswith(".meta.json")]
meta_files = [p for p in raw_dir.iterdir() if p.is_file() and p.name.endswith(".meta.json")]
all_files = [p for p in raw_dir.iterdir() if p.is_file()]

print(f"Total files in data/raw: {len(all_files)}")
print(f"Number of data files (non-meta): {len(data_files)}")
print(f"Number of sidecar files (*.meta.json): {len(meta_files)}")

total_data_size = sum(p.stat().st_size for p in data_files)
total_raw_size = sum(p.stat().st_size for p in all_files)
print(
    f"Total size of data files: {total_data_size} bytes ({total_data_size / (1024 * 1024):.2f} MB)"
)
print(
    f"Total size of all files in data/raw: {total_raw_size} bytes "
    f"({total_raw_size / (1024 * 1024):.2f} MB)"
)

requested_dates = set()
urls = set()
acquisition_methods = set()
user_agents = set()

one_import_sidecar_path = None
one_import_sidecar_content = None

for mf in meta_files:
    if "bhavcopy_import_" in mf.name and one_import_sidecar_path is None:
        one_import_sidecar_path = mf
        one_import_sidecar_content = mf.read_text(encoding="utf-8")
    try:
        data = json.loads(mf.read_text(encoding="utf-8"))
        if "requested_date" in data and data["requested_date"]:
            requested_dates.add(data["requested_date"])

        # Check url
        if "url" in data:
            urls.add(str(data.get("url")))

        # Check acquisition_method
        if "acquisition_method" in data:
            acquisition_methods.add(str(data.get("acquisition_method")))

        # Check user-agent
        if "user_agent" in data:
            user_agents.add(str(data.get("user_agent")))
        if "User-Agent" in data:
            user_agents.add(str(data.get("User-Agent")))
        if "headers" in data and isinstance(data["headers"], dict):
            for hk, hv in data["headers"].items():
                if hk.lower() == "user-agent":
                    user_agents.add(str(hv))
        if "request_headers" in data and isinstance(data["request_headers"], dict):
            for hk, hv in data["request_headers"].items():
                if hk.lower() == "user-agent":
                    user_agents.add(str(hv))

    except Exception as e:
        print(f"Error reading {mf.name}: {e}")

sorted_dates = sorted(list(requested_dates))
print(f"\nDistinct requested dates count: {len(sorted_dates)}")
if sorted_dates:
    print(f"Earliest requested date: {sorted_dates[0]}")
    print(f"Latest requested date: {sorted_dates[-1]}")
    print(f"All requested dates: {sorted_dates}")

print(f"\nDistinct url values: {urls}")
print(f"Distinct acquisition_method values: {acquisition_methods}")
print(f"Distinct User-Agent values: {user_agents}")

sidecar_name = one_import_sidecar_path.name if one_import_sidecar_path else "None"
print(f"\nOne bhavcopy_import_ sidecar ({sidecar_name}):")
print(one_import_sidecar_content)
