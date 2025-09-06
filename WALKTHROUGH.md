# TPV Match Application Walkthrough

## Quick Start Demo

This walkthrough demonstrates the TPV Colour Matcher application from setup to export.

### 1. Setup and Installation

```bash
# Clone and install dependencies
cd tpv-match
npm run install:all

# Terminal 1: Start the API server
npm run dev:api
# Server will start on http://localhost:3000

# Terminal 2: Start the frontend (in new terminal)
npm run dev:web
# App will be available on http://localhost:4321
```

### 2. Application Flow

#### Step 1: Upload Design
1. Open http://localhost:4321 in your browser
2. You'll see the TPV Colour Matcher homepage
3. Drag and drop a design file (PDF, PNG, JPG, or SVG) or click "Browse files"
4. Supported formats: PDF up to 50MB, images up to 50MB
5. Click "Extract Palette" to process the file

#### Step 2: Review Extracted Palette
1. The app extracts dominant colours from your design
2. View colour swatches with hex codes, RGB values, and Lab coordinates
3. See area percentages showing how much of each colour appears in the design
4. Select colours you want to match with TPV blends using checkboxes

#### Step 3: Configure Blend Constraints
1. **Mode Selection**: Choose between "Percentages" or "Parts" mode
   - Percentages: Results like "66.7% RH01, 33.3% RH10"
   - Parts: Results like "2 parts RH01, 1 part RH10"

2. **Blend Parameters**:
   - Max Components: 2 or 3 colour combinations
   - Ratio Step: Precision of calculations (1-10%)
   - Minimum Share: Minimum percentage per component (5-30%)

3. **Parts Mode Settings** (if selected):
   - Max Total Parts: Maximum parts in recipe (3-20)
   - Min Parts per Component: Minimum parts per colour (1-5)

4. **Lock Components** (optional):
   - Force specific TPV colours to be included in all blends
   - Useful for brand consistency or stock management

#### Step 4: Generate Blends
1. Click "Generate Blends" to calculate optimal TPV matches
2. The solver uses:
   - CIE Lab colour space for perceptual accuracy
   - ΔE2000 metric for visual difference assessment
   - Smart 2-way and 3-way search algorithms
   - Constraint satisfaction for practical mixing

#### Step 5: Review Recommendations
1. **Recipe Table** shows up to 3 best matches per target colour:
   - Visual swatch preview of the blend result
   - Recipe in your chosen format (percentages/parts)
   - ΔE2000 score (lower is better: <1 excellent, <2 good)
   - Component names (e.g., "RH01 Standard Red")

2. **Pin Recipes**: Click the pin button (📍) to mark preferred recipes

3. **Quality Assessment**:
   - ΔE < 1.0: Excellent match (barely perceptible difference)
   - ΔE < 2.0: Good match (acceptable for most applications)
   - ΔE < 4.0: Fair match (noticeable but usable)

#### Step 6: Export Results
1. **CSV Export**: Spreadsheet format with recipes, area percentages, and Bill of Materials
2. **JSON Export**: Structured data for integration with other systems
3. **PDF Spec**: Complete specification document with:
   - Visual swatches and comparisons
   - Detailed recipes and mixing instructions
   - Material calculations (thickness, density, wastage)

### 3. Example Results

For a design with a red colour similar to RGB(183, 30, 45):

**Single Component Match:**
- Recipe: 100% RH01 Standard Red
- ΔE: 0.1 (excellent match)

**Two Component Blend:**
- Recipe: 66.7% RH01 Standard Red, 33.3% RH10 Standard Green
- Parts: 2 parts RH01, 1 part RH10
- ΔE: 0.8 (excellent match)

### 4. Testing the Application

Run the unit test suite to verify colour calculations:

```bash
npm test
```

Tests cover:
- sRGB ↔ Lab colour conversions
- ΔE2000 difference calculations
- Parts/percentages conversion
- Blend simulation accuracy

### 5. Production Considerations

**Performance Targets:**
- Upload processing: <2 seconds for 5MB files
- Palette extraction: <5 seconds for complex designs
- Blend solving: <3 seconds for 3-component search

**Browser Compatibility:**
- Modern browsers with ES2020 support
- File API for uploads
- Canvas API for image processing

**File Limits:**
- Maximum upload size: 50MB
- Supported formats: PDF, PNG, JPG, SVG
- Automatic cleanup after 7 days

### 6. Troubleshooting

**Common Issues:**

1. **File Upload Fails**
   - Check file size (<50MB)
   - Verify supported format
   - Ensure API server is running on port 3000

2. **No Colours Extracted**
   - Try increasing DPI for PDF rasterization
   - Check if design has embedded colour information
   - Consider converting to PNG first

3. **Poor Blend Matches**
   - Adjust ratio step size for finer precision
   - Try different component limits
   - Consider if target colour is outside TPV gamut

4. **Parts Mode Issues**
   - Increase max total parts for better accuracy
   - Reduce minimum parts per component
   - Check that constraints are feasible

### 7. API Endpoints

For custom integrations:

- `POST /upload` - Upload and process files
- `GET /palette?jobId=...` - Get extracted colours
- `POST /solve` - Calculate blend recipes
- `GET /export?jobId=...&format=csv|json|pdf` - Download results

### 8. Development Notes

**Key Files:**
- `data/rosehill_tpv_21_colours.json` - TPV colour database
- `apps/web/src/lib/colour/` - Colour science algorithms
- `apps/web/src/lib/solver/` - Blend optimization
- `apps/api/src/routes/` - REST API endpoints

**Colour Science:**
- D65 illuminant standard
- sRGB → Linear RGB → XYZ → Lab pipeline
- Area-weighted mixing in linear RGB space
- ΔE2000 perceptual difference metric

This completes the walkthrough of the TPV Colour Matcher application!