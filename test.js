const filepreview = require('./filepreview');

filepreview.generate(
  // '/Users/parweb/Downloads/GPJ_210201_34378355_1_144537047.pptx',
  // '/Users/parweb/Downloads/GPJ_210201_34378355_1_144537047.pptx.png',
  '/Users/parweb/Downloads/Classeur1.xlsx',
  '/Users/parweb/Downloads/Classeur1.xlsx.png',
  { pagerange: '1-100' },
  error => {
    if (error) {
      return console.log(error);
    }
    console.log(
      'File preview is /Users/parweb/Downloads/GPJ_210201_34378355_1_144537047.pptx.png'
    );
  }
);
