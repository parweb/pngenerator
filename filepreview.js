var crypto = require('crypto');
var async = require('async');
var path = require('path');
var fs = require('fs');
var os = require('os');
var mimedb = require('./db.json');
const spawn = require('await-spawn');

const spawnOptions = { timeout: 150000, detached: true };

const format = input => input.split('.').reverse()[0];

module.exports = {
  generate: async (input_original, output, options, callback) => {
    var input = input_original;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    } else {
      options = options || {};
    }

    // Check for supported output format
    var extOutput = path.extname(output).toLowerCase().replace('.', '');
    var extInput = path.extname(input).toLowerCase().replace('.', '');

    if (extOutput != 'gif' && extOutput != 'jpg' && extOutput != 'png') {
      return callback(true);
    }

    var fileArgs = [input_original];
    console.log('01', 'file', fileArgs);
    var is_executable = (await spawn('file', fileArgs, spawnOptions))
      .toString()
      .indexOf('executable');

    if (parseInt(is_executable) > 0) {
      return callback(true);
    }

    var fileType = 'other';

    root: for (var index in mimedb) {
      if ('extensions' in mimedb[index]) {
        for (var indexExt in mimedb[index].extensions) {
          if (mimedb[index].extensions[indexExt] == extInput) {
            if (index.split('/')[0] == 'image') {
              fileType = 'image';
            } else if (index.split('/')[0] == 'video') {
              fileType = 'video';
            } else {
              fileType = 'other';
            }

            break root;
          }
        }
      }
    }

    if (extInput == 'pdf') {
      fileType = 'image';
    }

    if (
      input_original.indexOf('http://') == 0 ||
      input_original.indexOf('https://') == 0
    ) {
      var url = input.split('/');
      var url_filename = url[url.length - 1];
      var hash = crypto.createHash('sha512');
      hash.update(Math.random().toString());
      hash = hash.digest('hex');
      var temp_input = path.join(os.tmpdir(), hash + url_filename);
      curlArgs = ['--silent', '-L', input, '-o', temp_input];
      console.log('02', 'curl', curlArgs);
      await spawn('curl', curlArgs, spawnOptions);
      input = temp_input;
    }

    try {
      const stats = fs.lstatSync(input);

      if (!stats.isFile()) {
        return callback(true);
      } else {
        if (fileType == 'video') {
          var ffmpegArgs = [
            '-y',
            '-i',
            input,
            '-vf',
            'thumbnail',
            '-frames:v',
            '1',
            output
          ];
          if (options.width > 0 && options.height > 0) {
            ffmpegArgs.splice(
              4,
              1,
              'thumbnail,scale=' +
                options.width +
                ':' +
                options.height +
                (options.forceAspect
                  ? ':force_original_aspect_ratio=decrease'
                  : '')
            );
          }

          try {
            console.log('03', 'ffmpeg', ffmpegArgs);
            await spawn('ffmpeg', ffmpegArgs, spawnOptions);

            if (
              input_original.indexOf('http://') == 0 ||
              input_original.indexOf('https://') == 0
            ) {
              fs.unlinkSync(input);
            }

            return callback();
          } catch (error) {
            console.log('01', error);
            return callback(error);
          }
        }

        if (fileType == 'image') {
          var convertArgs = [input + '[0]', output];

          if (options.width > 0 && options.height > 0) {
            convertArgs.splice(
              0,
              0,
              '-resize',
              options.width + 'x' + options.height
            );
          }

          if (options.autorotate) {
            convertArgs.splice(0, 0, '-auto-orient');
          }

          if (options.quality) {
            convertArgs.splice(0, 0, '-quality', options.quality);
          }

          if (options.background) {
            convertArgs.splice(0, 0, '-background', options.background);
            convertArgs.splice(0, 0, '-flatten');
          }

          try {
            console.log('04', 'convert', convertArgs);
            await spawn('convert', convertArgs, spawnOptions);

            if (
              input_original.indexOf('http://') == 0 ||
              input_original.indexOf('https://') == 0
            ) {
              fs.unlinkSync(input);
            }

            return callback();
          } catch (error) {
            console.log('02', error);
            return callback(error);
          }
        }

        if (fileType == 'other') {
          var hash = crypto.createHash('sha512');
          hash.update(Math.random().toString());
          hash = hash.digest('hex');

          var tempPDF = path.join(os.tmpdir(), hash + '.pdf');

          var unoconv_pagerange = '1';
          var pagerange_start = 1;
          var pagerange_stop = 1;
          if (options.pagerange) {
            var pagerange = options.pagerange.split('-');
            if (pagerange.length == 2) {
              unoconv_pagerange = options.pagerange;
              pagerange_start = pagerange[0];
              pagerange_stop = pagerange[1];
            }
          }

          if (unoconv_pagerange == '1') {
            try {
              console.log('05', 'unoconv', [
                '-e',
                'PageRange=' + unoconv_pagerange,
                '-o',
                tempPDF,
                input
              ]);
              await spawn(
                'unoconv',
                ['-e', 'PageRange=' + unoconv_pagerange, '-o', tempPDF, input],
                spawnOptions
              );

              var convertOtherArgs = [tempPDF + '[0]', output];

              if (options.width > 0 && options.height > 0) {
                convertOtherArgs.splice(
                  0,
                  0,
                  '-resize',
                  options.width + 'x' + options.height
                );
              }

              if (options.quality) {
                convertOtherArgs.splice(0, 0, '-quality', options.quality);
              }

              try {
                console.log('06', 'convert', convertOtherArgs);
                await spawn('convert', convertOtherArgs, spawnOptions);

                fs.unlink(tempPDF, error => {
                  if (
                    input_original.indexOf('http://') == 0 ||
                    input_original.indexOf('https://') == 0
                  ) {
                    fs.unlink(input);
                  }

                  if (error) return callback(error);
                  return callback();
                });
              } catch (error) {
                console.log('03', error);
                return callback(error);
              }
            } catch (error) {
              console.log('04', error);
              return callback(error);
            }
          } else {
            console.log('07', 'unoconv', [
              '-e',
              'PageRange=' + unoconv_pagerange,
              '-o',
              tempPDF,
              input
            ]);
            try {
              await spawn(
                'unoconv',
                ['-e', 'PageRange=' + unoconv_pagerange, '-o', tempPDF, input],
                spawnOptions
              );

              var pages = [];
              var toRemove = [];

              for (var page = 0; page < pagerange_stop; page++) {
                pages.push(page);
              }

              await Promise.all(
                pages.map(page => {
                  console.log('start', { page });

                  const extension = format(output);

                  var convertOtherArgs = [
                    tempPDF + '[' + page + ']',
                    output.replace(`.${extension}`, `_${page}.${extension}`)
                  ];

                  if (options.width > 0 && options.height > 0) {
                    convertOtherArgs.splice(
                      0,
                      0,
                      '-resize',
                      options.width + 'x' + options.height
                    );
                  }

                  if (options.quality) {
                    convertOtherArgs.splice(0, 0, '-quality', options.quality);
                  }

                  return spawn('convert', convertOtherArgs, spawnOptions)
                    .then(() => {
                      toRemove.push(convertOtherArgs.slice(-1)[0]);
                    })
                    .catch(error => {
                      console.log('05', error);
                      console.log({
                        'error?.code !== 1': error?.code !== 1,
                        '!error?.message.includes': !error?.message.includes(
                          'Requested FirstPage is greater than the number of pages'
                        ),
                        both:
                          error?.code !== 1 &&
                          !error?.message.includes(
                            'Requested FirstPage is greater than the number of pages'
                          )
                      });

                      if (
                        error?.code !== 1 &&
                        !error?.message.includes(
                          'Requested FirstPage is greater than the number of pages'
                        )
                      ) {
                        return callback(error);
                      }
                    })
                    .finally(() => {
                      console.log('end', { page });
                    });
                })
              );

              fs.unlink(tempPDF, async error => {
                if (
                  input_original.indexOf('http://') == 0 ||
                  input_original.indexOf('https://') == 0
                ) {
                  fs.unlinkSync(input);
                }
                if (error) return callback(error);

                const extension = format(output);

                console.log('000', 'convert', [
                  '-append',
                  output.replace(`.${extension}`, `_*.${extension}`),
                  output
                ]);

                try {
                  await spawn(
                    'convert',
                    [
                      '-append',
                      output.replace(`.${extension}`, `_*.${extension}`),
                      output
                    ],
                    spawnOptions
                  );

                  console.log({ toRemove });

                  try {
                    toRemove.forEach(file_path => {
                      console.log('toRemove', { file_path });
                      if (fs.existsSync(file_path)) {
                        fs.unlinkSync(file_path);
                      }
                    });
                  } catch (_) {
                    console.log('06', _);
                  }

                  return callback();
                } catch (error) {
                  console.log('07', error);
                  return callback(error);
                }
              });
            } catch (error) {
              console.log('08', error);
              return callback(error);
            }
          }
        }
      }
    } catch (error) {
      console.log('09', error);
      return callback(error);
    }
  },

  generateSync: async (input_original, output, options = {}) => {
    var input = input_original;

    // Check for supported output format
    var extOutput = path.extname(output).toLowerCase().replace('.', '');
    var extInput = path.extname(input).toLowerCase().replace('.', '');

    if (extOutput != 'gif' && extOutput != 'jpg' && extOutput != 'png') {
      return false;
    }

    var fileArgs = [input_original];
    console.log('09', 'file', fileArgs);
    var is_executable = (await spawn('file', fileArgs, spawnOptions))
      .toString()
      .indexOf('executable');

    if (parseInt(is_executable) > 0) {
      return callback(true);
    }

    var fileType = 'other';

    root: for (var index in mimedb) {
      if ('extensions' in mimedb[index]) {
        for (var indexExt in mimedb[index].extensions) {
          if (mimedb[index].extensions[indexExt] == extInput) {
            if (index.split('/')[0] == 'image') {
              fileType = 'image';
            } else if (index.split('/')[0] == 'video') {
              fileType = 'video';
            } else {
              fileType = 'other';
            }

            break root;
          }
        }
      }
    }

    if (extInput == 'pdf') {
      fileType = 'image';
    }

    if (
      input_original.indexOf('http://') == 0 ||
      input_original.indexOf('https://') == 0
    ) {
      var url = input.split('/');
      var url_filename = url[url.length - 1];
      var hash = crypto.createHash('sha512');
      hash.update(Math.random().toString());
      hash = hash.digest('hex');
      var temp_input = path.join(os.tmpdir(), hash + url_filename);
      curlArgs = ['--silent', '-L', input, '-o', temp_input];
      console.log('10', 'curl', curlArgs);
      await spawn('curl', curlArgs, spawnOptions);
      input = temp_input;
    }

    try {
      stats = fs.lstatSync(input);

      if (!stats.isFile()) {
        return false;
      }
    } catch (e) {
      console.log('11', e);
      return false;
    }

    if (fileType == 'video') {
      try {
        var ffmpegArgs = [
          '-y',
          '-i',
          input,
          '-vf',
          'thumbnail',
          '-frames:v',
          '1',
          output
        ];

        if (options.width > 0 && options.height > 0) {
          ffmpegArgs.splice(
            4,
            1,
            'thumbnail,scale=' +
              options.width +
              ':' +
              options.height +
              (options.forceAspect
                ? ':force_original_aspect_ratio=decrease'
                : '')
          );
        }
        console.log('11', 'ffmpeg', ffmpegArgs);
        await spawn('ffmpeg', ffmpegArgs, spawnOptions);
        if (
          input_original.indexOf('http://') == 0 ||
          input_original.indexOf('https://') == 0
        ) {
          fs.unlinkSync(input);
        }
        return true;
      } catch (e) {
        console.log('12', e);
        return false;
      }
    }

    if (fileType == 'image') {
      try {
        var convertArgs = [input + '[0]', output];
        if (options.width > 0 && options.height > 0) {
          convertArgs.splice(
            0,
            0,
            '-resize',
            options.width + 'x' + options.height
          );
        }
        if (options.quality) {
          convertArgs.splice(0, 0, '-quality', options.quality);
        }
        if (options.background) {
          convertArgs.splice(0, 0, '-background', options.background);
          convertArgs.splice(0, 0, '-flatten');
        }
        console.log('12', 'convert', convertArgs);
        await spawn('convert', convertArgs, spawnOptions);
        if (
          input_original.indexOf('http://') == 0 ||
          input_original.indexOf('https://') == 0
        ) {
          fs.unlinkSync(input);
        }
        return true;
      } catch (e) {
        console.log('13', e);
        return false;
      }
    }

    if (fileType == 'other') {
      try {
        var hash = crypto.createHash('sha512');
        hash.update(Math.random().toString());
        hash = hash.digest('hex');

        var tempPDF = path.join(os.tmpdir(), hash + '.pdf');

        var unoconv_pagerange = '1';
        var pagerange_start = 1;
        var pagerange_stop = 1;
        if (options.pagerange) {
          var pagerange = options.pagerange.split('-');
          if (pagerange.length == 2) {
            unoconv_pagerange = options.pagerange;
            pagerange_start = pagerange[0];
            pagerange_stop = pagerange[1];
          }
        }

        try {
          console.log('13', 'unoconv', [
            '-e',
            'PageRange=' + unoconv_pagerange,
            '-o',
            tempPDF,
            input
          ]);
          const proc = spawn(
            'unoconv',
            ['-e', 'PageRange=' + unoconv_pagerange, '-o', tempPDF, input],
            spawnOptions
          );

          console.log({ child: proc.child });

          await proc;
        } catch (error) {
          console.log('14', { error });
        }

        if (unoconv_pagerange == '1') {
          var convertOtherArgs = [tempPDF + '[0]', output];

          if (options.width > 0 && options.height > 0) {
            convertOtherArgs.splice(
              0,
              0,
              '-resize',
              options.width + 'x' + options.height
            );
          }

          if (options.quality) {
            convertOtherArgs.splice(0, 0, '-quality', options.quality);
          }

          try {
            console.log('14', 'convert', convertOtherArgs);
            const proc = await spawn('convert', convertOtherArgs, spawnOptions);
            console.log({ child: proc.child });
          } catch (error) {
            console.log('15', { error });
          }
        } else {
          for (var x = 0; x < pagerange_stop; x++) {
            var convertOtherArgs = [tempPDF + '[' + x + ']', x + '_' + output];
            if (options.width > 0 && options.height > 0) {
              convertOtherArgs.splice(
                0,
                0,
                '-resize',
                options.width + 'x' + options.height
              );
            }
            if (options.quality) {
              convertOtherArgs.splice(0, 0, '-quality', options.quality);
            }
            console.log('15', 'convert', convertOtherArgs);
            await spawn('convert', convertOtherArgs, spawnOptions);
          }
        }

        fs.unlinkSync(tempPDF);

        if (
          input_original.indexOf('http://') == 0 ||
          input_original.indexOf('https://') == 0
        ) {
          fs.unlinkSync(input);
        }
        return true;
      } catch (e) {
        console.log('16', e);
        return false;
      }
    }
  }
};
