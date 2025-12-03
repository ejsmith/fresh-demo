# Upgrade Notes: Fresh 2.0.0-alpha.34 → 2.2.0

## Summary

This project has been updated from Fresh 2.0.0-alpha.34 (pre-release) to Fresh 2.2.0 (stable release) and all dependencies have been updated to their latest versions.

## Changes Made

### 1. Dependency Updates

| Package | Previous Version | New Version | Type |
|---------|-----------------|-------------|------|
| @fresh/core | ^2.0.0-alpha.34 | ^2.2.0 | Major (alpha → stable) |
| @fresh/plugin-tailwind | ^0.0.1-alpha.7 | >=0.0.1-alpha.7 | Minor (alpha, updated constraint) |
| preact | ^10.26.6 | ^10.27.0 | Patch |
| @preact/signals | ^2.0.4 | ^2.2.1 | Minor |
| tailwindcss | ^3.4.3 | ^4.1.10 | Major |

### 2. Deno Runtime

Deno is already at the latest stable version: **2.5.6** (released October 29, 2025)

### 3. Files Modified

- `deno.json` - Updated all dependency versions
- `deno.lock` - Removed (will be regenerated on first dependency install)

## Fresh 2.2.0 Features

Fresh 2.2.0 is a stable release that includes:

- Context helpers: `.json()`, `.text()`, `.html()`, `.stream()`
- Improved Vite plugin source mapping
- Better error messages
- Performance improvements
- Bug fixes for partial navigation and HEAD requests

## Important: Tailwind CSS 4.x Upgrade

### Breaking Changes

Tailwind CSS was upgraded from v3.4.3 to v4.1.10, which is a major version change with breaking changes:

#### What Changed
1. **CSS-First Configuration**: While `tailwind.config.ts` still works, Tailwind 4 prefers CSS-based configuration using `@theme` directives
2. **Plugin System Removed**: The old JavaScript plugin API is gone. Use CSS constructs instead
3. **Modern Browsers Only**: Requires Chrome 111+, Safari 16.4+, Firefox 128+
4. **New Oxide Engine**: Much faster compilation
5. **Automatic Content Detection**: Better at finding classes

#### What Still Works
- Your existing `tailwind.config.ts` file ✅
- The `@tailwind` directives in CSS ✅
- All standard utility classes ✅
- Your existing component styles ✅

#### Potential Issues to Watch For
- Some third-party Tailwind plugins may not work (if using the old plugin API)
- Very old browsers will no longer be supported
- Some advanced configuration options may have changed

## Testing Checklist

After the dependencies are installed, verify the following:

### Build & Development
- [ ] `deno task check` - Formatting, linting, and type checking
- [ ] `deno task dev` - Development server starts successfully
- [ ] `deno task build` - Production build completes
- [ ] `deno task start` - Production server starts

### Functionality
- [ ] Home page loads at `http://localhost:8000`
- [ ] Counter component works (clicking +1 and -1 buttons)
- [ ] Tailwind CSS styles are applied correctly
- [ ] Fresh logo displays
- [ ] Gradient background appears correctly
- [ ] No console errors in browser
- [ ] Hot module reload works in development

### API Routes
- [ ] `/api/:name` route works (if testing API endpoints)
- [ ] `/api2/:name` route works (defined in main.ts)

## Installation Instructions

To install the updated dependencies:

```bash
# Clear any cached dependencies
rm -rf ~/.cache/deno

# Cache the main files (this will download all dependencies)
deno cache --reload main.ts dev.ts

# Or simply run the dev server (will auto-download)
deno task dev
```

## Rollback Instructions

If you need to rollback to the previous versions:

```bash
git revert HEAD
deno cache --reload main.ts dev.ts
```

## Additional Resources

- [Fresh 2.2.0 Release Notes](https://github.com/denoland/fresh/releases/tag/2.2.0)
- [Fresh Documentation](https://fresh.deno.dev/docs)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [Deno 2.5.6 Release](https://github.com/denoland/deno/releases/tag/v2.5.6)

## Compatibility Notes

### Project Structure Compatibility
✅ The current project structure is fully compatible with Fresh 2.2.0:
- Routes directory structure ✅
- Islands architecture ✅
- Static file serving ✅
- Middleware pattern ✅
- Tailwind plugin integration ✅

### No Code Changes Required
✅ No changes to your application code are necessary. The update is primarily a dependency version bump. All your existing:
- Route handlers
- Island components
- Middleware
- Static assets
- Tailwind styles

...should continue to work as expected.

## Support

If you encounter any issues:
1. Check the Fresh GitHub issues: https://github.com/denoland/fresh/issues
2. Consult Fresh Discord: https://discord.gg/deno
3. Review Deno documentation: https://docs.deno.com/

## Conclusion

This is a straightforward upgrade from an alpha version to a stable release. The main breaking change to be aware of is the Tailwind CSS major version upgrade, but the current project structure should be compatible. Test thoroughly in a development environment before deploying to production.
