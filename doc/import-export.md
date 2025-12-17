# Import/Export Feature

The Neotypa Booktabs application now supports importing and exporting bookmarks using the standard **Netscape Bookmark File Format**, which is widely supported by all modern browsers (Chrome, Firefox, Edge, Safari, etc.).

## Overview

- **Export**: Download all your bookmarks as an HTML file in Netscape format
- **Import**: Upload bookmark files from other browsers or previous exports

## Export

To export your bookmarks:

1. Click the **Export** button in the header (download icon)
2. A file named `bookmarks-YYYY-MM-DD.html` will be downloaded
3. This file can be imported into any browser or back into Neotypa Booktabs

### Export Format

The export creates a hierarchical HTML structure:
- **Level 1**: Folders (H3 tags)
- **Level 2**: Groups (H3 tags nested within folders)
- **Level 3**: Bookmarks (A tags with HREF)

## Import

To import bookmarks:

1. Click the **Import** button in the header (upload icon)
2. Select your bookmark HTML file
3. Choose a strategy for handling deeply nested folders (see below)
4. Click **Import**

### Import Strategies

Our system supports a 3-level hierarchy: **Folder → Group → Bookmark**

Many browsers export bookmarks with deeper nesting levels. When importing files with deeper structures, you must choose how to handle them:

#### Flatten (Recommended)
- Converts folders deeper than the 3rd level into groups
- All bookmarks from deeply nested folders are preserved
- Best for preserving all content while adapting to our structure

#### Skip
- Skips bookmarks that are nested deeper than 3 levels
- Useful if you only want top-level bookmarks
- A summary will show how many bookmarks were skipped

### Import Results

After importing, you'll see a summary showing:
- Number of folders created
- Number of groups created
- Number of bookmarks imported
- Number of bookmarks skipped (if any)
- Warnings about any issues encountered

## Technical Details

### Netscape Bookmark Format

The Netscape format is an HTML-based format with this structure:

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Folder Name</H3>
    <DL><p>
        <DT><H3>Group Name</H3>
        <DL><p>
            <DT><A HREF="https://example.com">Bookmark Title</A>
            <DD>Optional description
        </DL><p>
    </DL><p>
</DL><p>
```

### API Endpoints

#### `GET /api/export`
- Returns: HTML file (Netscape format)
- Headers: Sets `Content-Disposition: attachment` for download

#### `POST /api/import`
- Body: `{ html: string, strategy: 'flatten' | 'skip' | 'root' }`
- Returns: `ImportResult` object with statistics and warnings

### Import Process

1. **Parse**: HTML is parsed into a tree structure
2. **Validate**: Structure is analyzed for depth and content
3. **Transform**: Deep structures are handled according to strategy
4. **Create**: Folders, groups, and bookmarks are created in database
5. **Report**: Statistics and warnings are returned

## Limitations

- Maximum 3-level hierarchy (Folder → Group → Bookmark)
- Bookmarks must be inside groups, not directly in folders
- No support for browser-specific metadata (favicons, visit counts, etc.)
- Tags are not preserved during import (can be added after import)

## Examples

### Exporting from Chrome

1. Chrome Menu → Bookmarks → Bookmark Manager
2. Three-dot menu → Export bookmarks
3. Save the HTML file
4. Use this file to import into Neotypa Booktabs

### Exporting from Firefox

1. Firefox Menu → Bookmarks → Manage Bookmarks
2. Import and Backup → Export Bookmarks to HTML
3. Save the HTML file
4. Use this file to import into Neotypa Booktabs

### Exporting from Edge

1. Edge Menu → Favorites → Manage favorites
2. Three-dot menu → Export favorites
3. Save the HTML file
4. Use this file to import into Neotypa Booktabs

## Migration Tips

1. **Start Fresh**: Consider exporting from your browser and importing into a new account
2. **Test First**: Try importing with the "Skip" strategy first to see the structure
3. **Cleanup**: After importing, you may want to reorganize folders and groups
4. **Tags**: Add tags manually after import for better organization
5. **Backup**: Always export your bookmarks before major changes
