var test = require('tape')
var request = require('..')
var express = require('express')

var reqMethods = ['options', 'head', 'get', 'post', 'put', 'patch', 'delete']
var _port = Math.round(Math.random() * 1000) + 5000
var port = () => ++_port

// fake express req object, which request expects
var req = (opts) => {
  opts = opts || {}
  return {
    headers: { cookie: opts.cookie || 'foo=bar' },
    protocol: opts.protocol || 'http',
    app: {
      get(v) {
        switch (v) {
          case 'host':
            return opts.host || '0.0.0.0'
          case 'port':
            return opts.port || port()
        }
      }
    }
  }
}

test('base is a curried function', t => {
  t.plan(2)
  t.equal(typeof request.base, 'function', 'request should be a function')
  var r = request.base(req())
  t.equal(typeof r, 'function', 'curried request should be a function')
})

test('base appends method aliases to curried function', t => {
  var aliases = reqMethods
  t.plan(aliases.length)
  var r = request.base(req())
  aliases.forEach(a => {
    t.equal(typeof r[a], 'function', `has a ${a} function`)
  })
})

var handleError = e => t.catch(e, 'should not error')

function performRequest(method, handler) {
  var app = express()
  app[method]('/test', handler)
  var opts = { port: port(), host: '0.0.0.0'}
  var r = request.base(req(opts))
  return new Promise((resolve, reject) => {
    var server = app.listen(opts.port, opts.host, () => {
      return new Promise((resolve, reject) => r[method]('/test').then(resolve, reject))
        .then(res => {
          resolve(res)
          server.close()
        })
        .catch(reject)
    })
  })
}

test('base requests a local url', t => {
  t.plan(1)
  performRequest('get', (req, res) => {
    res.send('hello')
  }).then(res => t.equal(res.text, 'hello', 'should make a local request'))
    .catch(handleError)
})

test('base handles all methods', t => {
  t.plan(reqMethods.length)
  Promise.all(reqMethods.map(m => {
    return performRequest(m, (req, res) => {
      res.status(200).end()
    }).then(res => {
      t.pass(`should make a ${m} request`)
    })
  })).catch(handleError)
})

test('base preserves cookies from original req', t => {
  t.plan(2)
  var opts = { port: port(), host: '0.0.0.0'}
  var reqOpts = req(opts)
  var app = express()
  performRequest('get', (req, res) => {
    t.deepEqual(req.headers.cookies, reqOpts.headers.cookies, 'should preserve cookies')
    res.send('hello')
  }).then(() => t.pass('completed request'))
    .catch(handleError)
})
