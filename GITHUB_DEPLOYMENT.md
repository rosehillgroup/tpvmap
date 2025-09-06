# GitHub to Netlify Deployment Guide

## Repository Setup

Repository: [https://github.com/rosehillgroup/tpvmap](https://github.com/rosehillgroup/tpvmap)

## Pre-Deployment Checklist

### 1. Repository Structure
Ensure your repository matches this structure:
```
tpvmap/
├── netlify.toml                     # Build configuration
├── package.json                     # Root package.json with build scripts
├── data/
│   └── rosehill_tpv_21_colours.json # TPV colour dataset
├── apps/
│   └── web/                         # Astro application
│       ├── package.json
│       ├── astro.config.mjs         # With Netlify adapter
│       └── src/
│           ├── pages/
│           │   ├── api/             # API routes (Netlify Functions)
│           │   │   ├── upload.ts
│           │   │   ├── palette.ts
│           │   │   ├── solve.ts
│           │   │   ├── export.ts
│           │   │   └── thumbnail/
│           │   ├── index.astro      # Landing page
│           │   └── results.astro    # Results page
│           ├── components/          # React components
│           ├── lib/                 # Colour science libraries
│           └── layouts/
└── README.md
```

### 2. Critical Files Check

**netlify.toml** (root level):
```toml
[build]
command = "cd apps/web && npm run build"
publish = "apps/web/dist"

[build.environment]
NODE_VERSION = "20"
```

**Root package.json build script**:
```json
{
  "scripts": {
    "build": "cd apps/web && npm run build"
  }
}
```

**apps/web/astro.config.mjs**:
```js
import netlify from '@astrojs/netlify';

export default defineConfig({
  adapter: netlify({ mode: 'directory' }),
  output: 'server'
});
```

## Netlify Deployment Steps

### 1. Connect Repository to Netlify

1. **Log in to Netlify**: [https://app.netlify.com](https://app.netlify.com)

2. **Import from Git**:
   - Click "New site from Git"
   - Choose "GitHub"
   - Authorize Netlify to access your repositories
   - Select `rosehillgroup/tpvmap`

### 2. Build Settings (Auto-detected from netlify.toml)

Netlify should automatically detect:
- **Build command**: `cd apps/web && npm run build`
- **Publish directory**: `apps/web/dist`
- **Functions directory**: `apps/web/dist/functions` (auto-generated)

If not auto-detected, manually set these values.

### 3. Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables:

**Required**:
```
NODE_VERSION = 20
```

**Optional** (for debugging):
```
DEBUG = netlify*
NODE_ENV = production
```

### 4. Domain Configuration (Optional)

**Custom Domain Setup**:
1. Site Settings → Domain management
2. Add custom domain: `tpvmap.rosehillgroup.com` (or preferred)
3. Configure DNS records as instructed
4. Enable HTTPS (automatic with Netlify)

### 5. Deploy Settings

**Branch Deploy**:
- **Production branch**: `main` or `master`
- **Deploy previews**: Enable for pull requests
- **Branch deploys**: Enable for development branches

## Post-Deployment Verification

### 1. Function Health Check

Visit these endpoints to verify:
- `https://your-site.netlify.app/api/upload` (POST) - Should return 405 Method Not Allowed
- `https://your-site.netlify.app/api/palette` (GET) - Should return 400 Missing jobId
- `https://your-site.netlify.app/` - Landing page loads

### 2. Test Upload Flow

1. **Upload a test image** (PNG/JPG under 50MB)
2. **Verify palette extraction** shows mock data
3. **Test blend generation** with default constraints
4. **Try CSV export** download

### 3. Monitor Function Logs

In Netlify Dashboard:
- **Functions tab**: Monitor function execution
- **Deploy tab**: Check build logs
- **Site analytics**: Monitor usage

## Troubleshooting

### Common Issues

**Build Failures**:
- Check Node version is set to 20 in environment variables
- Verify all dependencies are in package.json (not just package-lock.json)
- Check build logs for missing modules

**Function Timeouts**:
- Large files may exceed 26-second limit
- Check function logs for performance bottlenecks
- Consider chunked processing for large PDFs

**Memory Errors**:
- Functions have 1536MB limit
- Large images may need downsizing before processing
- Monitor function memory usage in logs

### Debug Commands

**Local testing**:
```bash
# Test build locally
npm run build

# Test with Netlify dev (requires netlify-cli)
npx netlify dev

# Check function compilation
npx netlify functions:list
```

**Deployment debugging**:
- Enable deploy notifications in Netlify
- Check function logs immediately after deploy
- Test API endpoints with curl/Postman

## Performance Optimization

### 1. Function Performance
- **Cold starts**: Keep functions warm with scheduled pings
- **Bundle size**: Minimize dependencies in API routes
- **Caching**: Leverage Netlify Blobs for computed results

### 2. Build Performance
- **Node version**: Use Node 20 for faster builds
- **Dependencies**: Regular cleanup of unused packages
- **Caching**: Netlify automatically caches node_modules

### 3. Runtime Performance
- **Image processing**: Optimize Sharp usage
- **Memory usage**: Monitor and optimize blend calculations
- **Response times**: Target <3 seconds for complex operations

## Monitoring Setup

### 1. Netlify Analytics
- Enable site analytics for traffic monitoring
- Monitor function execution counts
- Track build performance

### 2. Error Tracking
- Function logs capture console.error output
- Set up deploy notifications for failures
- Monitor blob storage usage

### 3. Performance Monitoring
- Track function execution times
- Monitor memory usage patterns
- Set up alerts for timeout issues

## Scaling Considerations

### Free Tier Limits
- **Functions**: 125,000 requests/month
- **Build minutes**: 300 minutes/month
- **Bandwidth**: 100GB/month
- **Blob storage**: 1GB

### Upgrade Triggers
- High function usage (>100k requests/month)
- Large file processing needs
- Need for background functions
- Custom domain requirements

## Security Best Practices

### 1. Environment Variables
- Never commit API keys to repository
- Use Netlify environment variables for secrets
- Rotate keys regularly

### 2. File Upload Security
- 50MB size limit enforced
- File type validation active
- No executable file uploads

### 3. Function Security
- Input validation on all endpoints
- Error messages don't leak sensitive data
- CORS headers configured appropriately

The repository is now ready for seamless GitHub → Netlify deployment! 🚀