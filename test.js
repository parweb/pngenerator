const filepreview = require('./filepreview');

filepreview.generate(
  '/Users/parweb/Sites/bbbcccaaa/sample.eml',
  '/Users/parweb/sites/bbbcccaaa/filepreview/myfile_preview.png',
  error => {
    if (error) {
      return console.log(error);
    }
    console.log(
      'File preview is /Users/parweb/sites/bbbcccaaa/filepreview/myfile_preview.png'
    );
  }
);
