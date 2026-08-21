from astroquery.ipac.ned import Ned
import json
import os

print("Querying NASA NED for 3C 273...")
result_table = Ned.query_object("3C 273")

# Extract core metadata (e.g., coordinates, redshift)
quasar_data = {
    "name": "3C 273",
    "ra": float(result_table['RA'][0]),
    "dec": float(result_table['DEC'][0]),
    "redshift": float(result_table['Redshift'][0]) if 'Redshift' in result_table.colnames else 0.158336,
    "source": "NASA/IPAC Extragalactic Database (NED)"
}

# Ensure a public data directory exists
os.makedirs("public/data", exist_ok=True)

# Save to a JSON file that your Three.js app can fetch
output_path = "public/data/quasar_3c273.json"
with open(output_path, "w") as f:
    json.dump(quasar_data, f, indent=4)

print(f"Successfully saved quasar data to {output_path}!")
