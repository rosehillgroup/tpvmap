# TPV Colour Matcher

![CI](https://github.com/rosehillgroup/tpvmap/workflows/CI/badge.svg)
[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_SITE_ID/deploy-status.svg)](https://app.netlify.com/sites/YOUR_SITE_NAME/deploys)

A production-ready web application that allows designers to upload their surfacing designs (PDF, PNG, JPG, SVG), automatically extract the design palette, and suggest Rosehill TPV custom blends from 21 base colours to match each palette colour.

**🚀 [Live Demo](https://YOUR_SITE_NAME.netlify.app)** | **📖 [Deploy Guide](./GITHUB_DEPLOYMENT.md)**

## Features

- **Multi-format Upload**: Supports PDF, PNG, JPG, and SVG files up to 50MB
- **Palette Extraction**: Vector and raster analysis to extract dominant colours with area percentages
- **Colour Science**: CIE Lab colour space with ΔE2000 difference calculations for accurate matching
- **Blend Solver**: Intelligent 2-way and 3-way blend search with constraints
- **Parts Mode**: Integer ratio calculations with GCD reduction for practical mixing
- **Export Options**: CSV, JSON, and PDF specifications with Bill of Materials

## Tech Stack

- **Frontend**: Astro + React + TypeScript
- **Backend**: Node.js + Hono + TypeScript
- **Colour Processing**: Sharp for image processing, pdf.js for PDF handling
- **Storage**: File-based caching with SHA-256 hashing
- **Testing**: Vitest for unit tests

## Project Structure

```
tpv-match/
├── apps/
│   ├── web/                 # Astro frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── lib/         # Colour science libraries
│   │   │   ├── pages/       # Astro pages
│   │   │   └── layouts/     # Layout components
│   │   └── package.json
│   └── api/                 # Hono backend
│       ├── src/
│       │   ├── routes/      # API endpoints
│       │   └── lib/         # Server utilities
│       └── package.json
├── data/
│   └── rosehill_tpv_21_colours.json  # TPV colour dataset
└── README.md
```

## Setup

### Prerequisites

- Node.js 20+ (recommended, 18.19.1+ may work with warnings)
- npm

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd tpv-match
   ```

2. **Install dependencies**:
   ```bash
   npm run install:all
   ```

### Development

**Standard development** (Astro dev server):
```bash
npm run dev
```
App runs on http://localhost:4321

**Netlify development** (with Functions emulation):
```bash
npm run dev:netlify
```
Requires Netlify CLI: `npm install -g netlify-cli`

### Testing

Run unit tests for the colour science algorithms:

```bash
cd apps/web
npm run test
```

### Building for Production

**Local build test**:
```bash
npm run build
npm run preview
```

**Deploy to Netlify**:
```bash
npm run deploy
```

See [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) for detailed deployment instructions.

## Usage

1. **Upload Design**: Drag and drop or browse for PDF, PNG, JPG, or SVG files
2. **Review Palette**: View extracted colours with area percentages
3. **Configure Constraints**: Set max components, ratio steps, and mode (percentages/parts)
4. **Generate Blends**: Calculate optimal TPV colour matches with ΔE2000 scores
5. **Export Results**: Download CSV, JSON, or PDF specifications

## Colour Science

The application uses industry-standard colour science:

- **Colour Space**: CIE Lab (D65 illuminant) for perceptual uniformity
- **Difference Metric**: ΔE2000 for accurate visual difference assessment
- **Mixing Model**: Area-weighted blending in linear RGB space
- **Gamut**: sRGB for display compatibility

## API Endpoints

- `POST /api/upload` - Upload and process design files
- `GET /api/palette` - Retrieve extracted colour palette
- `POST /api/solve` - Generate blend recommendations
- `GET /api/export` - Download results in various formats
- `GET /api/thumbnail/*` - Serve generated thumbnails

## Testing Data

The solver is validated against the 21 Rosehill TPV colours:

- Single-component colours return exact matches (ΔE ≈ 0)
- Multi-component blends typically achieve ΔE < 2.0
- Parts mode maintains accuracy within ΔE ±0.5 of continuous solutions

## Performance

- Upload processing: < 2 seconds for 5MB files
- Palette extraction: Vector + raster analysis
- Blend solving: Cached 2-way search + seeded 3-way optimization
- Memory efficient: Streaming file processing

## Browser Support

- Modern browsers with ES2020 support
- File API for drag-and-drop uploads
- Canvas API for image processing

## Production Considerations

- Configure reverse proxy (nginx/Apache) for static file serving
- Set appropriate file upload limits
- Enable HTTPS for secure file uploads
- Implement rate limiting on API endpoints
- Monitor disk usage for cached uploads (auto-cleanup after 7 days)

## Troubleshooting

### Common Issues

1. **File Upload Fails**:
   - Check file size (< 50MB)
   - Verify file format (PDF, PNG, JPG, SVG)
   - Ensure API server is running

2. **Colour Extraction Issues**:
   - PDF files may need rasterization for complex designs
   - SVG files require proper colour definitions

3. **Blend Solver Errors**:
   - Check constraint combinations are feasible
   - Ensure minimum component percentages allow valid solutions

### Node.js Version Issues

Some packages require Node.js 20+. If you encounter engine warnings:
- Consider upgrading Node.js
- Or use `npm install --ignore-engines` (not recommended for production)

## License

ISC License - See package.json for details

## Contributing

1. Follow TypeScript best practices
2. Run tests before submitting PRs
3. Update documentation for new features
4. British English spelling in UI copy