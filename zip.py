import os
import zipfile
import sys
from rich.console import Console
print = Console().print

def zip_folder(folder_path, output_path):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, folder_path)
                zipf.write(file_path, arcname)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python zip.py <folder_to_zip>")
        sys.exit(1)

    folder_to_zip = os.path.join(os.getcwd(), sys.argv[1])
    if not os.path.isdir(folder_to_zip):
        print(f"Error: [cyan]{folder_to_zip}[/cyan] is not a valid folder.")
        sys.exit(1)

    output_zip = folder_to_zip.rstrip(os.path.sep) + ".zip"
    zip_folder(folder_to_zip, output_zip)
    print(f"Folder [cyan]{folder_to_zip.rstrip(os.path.sep)}[/cyan] has been zipped into [green]{output_zip}[/].")