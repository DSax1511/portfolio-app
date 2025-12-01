# Change Verification Test Guide

## Quick Test Steps

### 1. Import the Debug Component
Add this to `MathEnginePage.jsx` (or any page you want to test):

```jsx
import DebugTest from "../../components/DebugTest";
```

Then add this in your JSX output (somewhere visible):
```jsx
<DebugTest />
```

### 2. Make a Change
Edit `/Users/dfsaxton/portfolio-app/client/src/components/DebugTest.jsx` and:
- Change the background color from `#FFD700` to `#00FF00` (green)
- Change the text to something different
- Save the file

### 3. Check the Website
Watch your browser. You should see:
- **HMR Active (Good)**: The page hot-reloads and shows your change immediately
- **HMR Not Working (Bad)**: You need to manually refresh the page to see changes
- **Still No Change (Problem)**: Your dev server isn't running or there's a build issue

## Troubleshooting

### If changes don't appear:

1. **Is the dev server running?**
   ```bash
   cd /Users/dfsaxton/portfolio-app/client
   npm run dev
   ```

2. **Try a hard refresh** (Cmd+Shift+R on Mac)

3. **Check browser console** (F12) for errors

4. **Restart the dev server** and clear browser cache

### If the component won't import:
- Make sure `DebugTest.jsx` is saved in `/Users/dfsaxton/portfolio-app/client/src/components/`
- Check that the import path is correct relative to your file

## Once Confirmed Working

After you've confirmed changes are being reflected:
1. Remove the `<DebugTest />` component from your pages
2. Your actual changes to `MathEnginePage.jsx` and `MarketStatusTicker.jsx` should now work as expected
