module.exports = {
  doSuggestion: function (resIn) {
    const resp = {
      response: {
        status: resIn.status
      }
    };

    this.suggestHeaders(resp, resIn);
    this.suggestData(resp, resIn);

    // console.log(response.headers);
    // console.log('  || data');
    // console.log(response.data);
    // console.log('--||');

    let output = JSON.stringify(resp, null, 2);
    output = output.substring(1);
    output = output.substring(0, output.length - 1).trim();
    console.log('  ||');
    console.log('  || Suggested \'response\' JSON for this test\r\n');
    console.log('  ' + output);
    console.log('\r\n  ||');
  },

  suggestHeaders: function (resp, resIn) {
    if (resIn.headers['content-type']) {
      resp.response.contentType = resIn.headers['content-type'];
    }
  },

  suggestData: function (resp, resIn) {
    if (resIn.headers['content-type'].indexOf('json') > 0) {
      this.suggestJson(resp, resIn.data);
    }
  },

  suggestJson: function (resp, data) {
    console.log(data);

    resp.response.hasKey = [];
    this.suggestHasKeys(resp, data, resp.response.hasKey, 'data');
  },

  suggestHasKeys: function (resp, data, keyArr, path) {
    if (Array.isArray(data)) {
      for (let x = 0; x < data.length; x++) {
        keyArr.push(`${path}[${x}]`);
      }
    } else {
      for (const key in data) {
        keyArr.push(`${path}['${key}']`);
      }
    }
  }
};
