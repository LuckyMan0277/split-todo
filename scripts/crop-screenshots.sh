#!/bin/bash

# App Store Screenshot Crop Script
# Crops screenshots to required sizes for App Store submission

# Required sizes
IPHONE_67="1290x2796"  # 6.7" Display (iPhone 15 Pro Max, 14 Pro Max)
IPHONE_65="1242x2688"  # 6.5" Display (iPhone 11 Pro Max, XS Max)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📱 App Store Screenshot Cropper"
echo "================================"

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null
then
    echo -e "${RED}❌ ImageMagick is not installed${NC}"
    echo ""
    echo "Please install ImageMagick:"
    echo "  macOS:   brew install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    echo ""
    exit 1
fi

# Use 'magick convert' if available, otherwise 'convert'
if command -v magick &> /dev/null; then
    CONVERT_CMD="magick convert"
else
    CONVERT_CMD="convert"
fi

# Create output directories
mkdir -p screenshots/6.7-inch
mkdir -p screenshots/6.5-inch

# Check if there are any PNG files
if ! ls *.png 1> /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  No PNG files found in current directory${NC}"
    echo ""
    echo "Please place your screenshots in this directory and run again."
    exit 1
fi

echo ""
echo "Processing screenshots..."
echo ""

# Counter for processed files
count_67=0
count_65=0

# Process each PNG file
for file in *.png; do
    base_name=$(basename "$file" .png)

    echo -e "${GREEN}Processing: $file${NC}"

    # Crop to 6.7" size
    $CONVERT_CMD "$file" \
        -resize ${IPHONE_67}^ \
        -gravity center \
        -extent ${IPHONE_67} \
        "screenshots/6.7-inch/${base_name}.png"

    if [ $? -eq 0 ]; then
        ((count_67++))
        echo "  ✓ Created 6.7\" version"
    fi

    # Crop to 6.5" size
    $CONVERT_CMD "$file" \
        -resize ${IPHONE_65}^ \
        -gravity center \
        -extent ${IPHONE_65} \
        "screenshots/6.5-inch/${base_name}.png"

    if [ $? -eq 0 ]; then
        ((count_65++))
        echo "  ✓ Created 6.5\" version"
    fi

    echo ""
done

echo "================================"
echo -e "${GREEN}✅ Processing complete!${NC}"
echo ""
echo "Created:"
echo "  📱 $count_67 screenshots for 6.7\" display (1290x2796)"
echo "  📱 $count_65 screenshots for 6.5\" display (1242x2688)"
echo ""
echo "Output locations:"
echo "  screenshots/6.7-inch/"
echo "  screenshots/6.5-inch/"
echo ""
echo "Next steps:"
echo "  1. Review the cropped screenshots"
echo "  2. Upload to App Store Connect"
echo ""
