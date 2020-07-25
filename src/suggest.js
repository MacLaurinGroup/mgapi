module.exports = {
  doSuggestion: function (resIn) {
    const resp = {
      response: {
        status: resIn.status,
        'function onPass(env,data)': ''
      }
    };

    this.suggestHeaders(resp, resIn);
    this.suggestData(resp, resIn);

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
    } else {
      this.suggestContent(resp, resIn.data);
    }
  },

  suggestContent (resp, data) {
    resp.containsString = (data.length > 32) ? data.substring(0, 32) : data;
  },

  suggestJson: function (resp, data) {
    resp.response.hasKey = [];
    resp.response.dataType = {};
    resp.response.extract = {};
    resp.response.extractJWT = '';

    this.suggestDataTypes(resp, data, resp.response.hasKey, resp.response.dataType, 'data');
  },

  suggestDataTypes: function (resp, data, keyArr, dataType, path) {
    if (Array.isArray(data)) {
      for (let x = 0; x < data.length; x++) {
        const dataPath = `${path}[${x}]`;
        keyArr.push(dataPath);

        dataType[dataPath] = {
          required: true,
          typeof: Array.isArray(data[x]) ? 'array' : typeof (data[x])
        };
        if (this.isSimple(data[x])) {
          dataType[dataPath].eq = data[x];
        }

        if (data[x] != null && (Array.isArray(data[x]) || typeof data[x] === 'object')) {
          this.suggestDataTypes(resp, data[x], keyArr, dataType, dataPath);
        }
      }
    } else {
      for (const key in data) {
        const dataPath = `${path}['${key}']`;
        keyArr.push(dataPath);

        dataType[dataPath] = {
          required: true,
          typeof: Array.isArray(data[key]) ? 'array' : typeof (data[key])
        };
        if (this.isSimple(data[key])) {
          dataType[dataPath].eq = data[key];
        }

        if (data[key] != null && (Array.isArray(data[key]) || typeof data[key] === 'object')) {
          this.suggestDataTypes(resp, data[key], keyArr, dataType, dataPath);
        }
      }
    }
  },

  isSimple: function (data) {
    const dt = Array.isArray(data) ? 'array' : typeof (data);
    return (dt !== 'object' && dt !== 'array');
  }
};
