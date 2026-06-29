import os
from PIL import Image, ImageOps

# Source image path
src_image_path = r"C:\Users\JSH\.gemini\antigravity\brain\a2a3be6d-0e2d-40a4-ae2b-6bfd19c22b61\media__1782696784110.jpg"
public_dir = r"c:\Users\JSH\Downloads\legal-crm---회생파산-상담-플랫폼\public"

def make_transparent(img, threshold=240):
    # Convert to RGBA
    rgba = img.convert("RGBA")
    data = rgba.getdata()
    
    new_data = []
    for item in data:
        # item is (r, g, b, a)
        # Check if pixel is close to white
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            # Make it transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    rgba.putdata(new_data)
    return rgba

def process():
    if not os.path.exists(src_image_path):
        print(f"Error: Source image not found at {src_image_path}")
        return

    # Open image
    img = Image.open(src_image_path)
    
    # 1. Create transparent background version
    img_transparent = make_transparent(img, threshold=240)
    
    # Save different favicon formats
    # 16x16 and 32x32 transparent PNGs
    fav16 = img_transparent.resize((16, 16), Image.Resampling.LANCZOS)
    fav32 = img_transparent.resize((32, 32), Image.Resampling.LANCZOS)
    fav48 = img_transparent.resize((48, 48), Image.Resampling.LANCZOS)
    
    # Save standard favicon.ico containing multiple sizes
    ico_path = os.path.join(public_dir, "favicon.ico")
    # ICO can save multiple sizes
    fav32.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Saved favicon.ico to {ico_path}")
    
    # Save PNG versions
    png32_path = os.path.join(public_dir, "favicon-32x32.png")
    fav32.save(png32_path, "PNG")
    print(f"Saved favicon-32x32.png to {png32_path}")
    
    png16_path = os.path.join(public_dir, "favicon-16x16.png")
    fav16.save(png16_path, "PNG")
    print(f"Saved favicon-16x16.png to {png16_path}")
    
    # Save apple touch icon (usually 180x180) - typically white background is fine or transparent. Let's make it 180x180.
    # For apple-touch-icon, iOS automatically adds a black background if it is transparent, 
    # so iOS guidelines suggest using a solid background. Let's keep a white background for the apple-touch-icon.
    apple_icon = img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_path = os.path.join(public_dir, "apple-touch-icon.png")
    apple_icon.save(apple_path, "PNG")
    print(f"Saved apple-touch-icon.png to {apple_path}")
    
    # Also save a 192x192 and 512x512 transparent PNGs just in case
    png192_path = os.path.join(public_dir, "android-chrome-192x192.png")
    fav192 = img_transparent.resize((192, 192), Image.Resampling.LANCZOS)
    fav192.save(png192_path, "PNG")
    print(f"Saved android-chrome-192x192.png to {png192_path}")
    
    png512_path = os.path.join(public_dir, "android-chrome-512x512.png")
    fav512 = img_transparent.resize((512, 512), Image.Resampling.LANCZOS)
    fav512.save(png512_path, "PNG")
    print(f"Saved android-chrome-512x512.png to {png512_path}")

if __name__ == "__main__":
    process()
