const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '../node_modules/html2canvas/dist/html2canvas.js'),
  path.join(__dirname, '../node_modules/html2canvas/dist/html2canvas.esm.js')
];

const searchStr = `var SUPPORTED_COLOR_FUNCTIONS = {
    hsl: hsl,
    hsla: hsl,
    rgb: rgb,
    rgba: rgb
};`;

const replacementStr = `var SUPPORTED_COLOR_FUNCTIONS = {
    hsl: hsl,
    hsla: hsl,
    rgb: rgb,
    rgba: rgb,
    oklch: function(context, values) { return pack(120, 130, 140, 1); },
    oklab: function(context, values) { return pack(120, 130, 140, 1); },
    OKLCH: function(context, values) { return pack(120, 130, 140, 1); },
    OKLAB: function(context, values) { return pack(120, 130, 140, 1); }
};`;

targets.forEach(target => {
  if (fs.existsSync(target)) {
    console.log(`Patching ${target}...`);
    let content = fs.readFileSync(target, 'utf8');
    if (content.includes(searchStr)) {
      content = content.replace(searchStr, replacementStr);
      fs.writeFileSync(target, content, 'utf8');
      console.log(`Successfully patched ${target}`);
    } else {
      // Try alternate whitespace patterns if formatting differs
      const searchStrAlt = searchStr.replace(/\s+/g, ' ');
      const contentAlt = content.replace(/\s+/g, ' ');
      if (contentAlt.includes(searchStrAlt)) {
        // Let's do a looser replacement
        console.log(`Found alternate formatting in ${target}, patching...`);
        // We find the index of SUPPORTED_COLOR_FUNCTIONS in the content
        const index = content.indexOf('var SUPPORTED_COLOR_FUNCTIONS = {');
        if (index !== -1) {
          const endIndex = content.indexOf('};', index);
          if (endIndex !== -1) {
            const before = content.substring(0, index);
            const after = content.substring(endIndex + 2);
            content = before + replacementStr + after;
            fs.writeFileSync(target, content, 'utf8');
            console.log(`Successfully patched ${target} with alternate method`);
          }
        }
      } else {
        console.log(`Could not find target string in ${target}. Already patched or structure changed.`);
      }
    }
  } else {
    console.warn(`Target file ${target} does not exist`);
  }
});
