from astroquery.ipac.ned import Ned
import astropy.units as u

# Query a specific quasar by name to get coordinates and metadata
result_table = Ned.query_object("3C 273")
print(result_table)

# Fetch direct image URLs or FITS cutout packages for the target region
image_list = Ned.get_image_list("3C 273")
print(image_list)
