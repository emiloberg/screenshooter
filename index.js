const sanitizeFilename = require("sanitize-filename")
const fetch = require("node-fetch")
const Nightmare = require("nightmare")
const vo = require("vo")
const fs = require("fs-extra")
const path = require("path")


// BR, NX
// const LOCALES = ["DK", "FI", "FI-SV", "FR", "DE", "GB", "IT", "MX", "NO", "ES", "SE", "NL"]
const LOCALES = ["gb"]
const API_ENDPOINT = "http://kitsune.izettle.com/api/pages"
const DOMAIN = "https://www.izettle.com"

const sanitize = (str) => {
  str = str.replace(DOMAIN, "")
  str = str.replace(/^\//, "")
  str = str.replace(/\//gmi, "-")
  return str
}

fs.ensureDirSync(path.join(__dirname, "screenshots"))

function fetchURLs() {
  return fetch(API_ENDPOINT)
  .then(res => res.json())
  .then(res =>
    res.containers.map(pages =>
     pages.currentRevision.published === false ? null : pages.currentRevision.url
    )
  )
  .then(urls => urls.filter(url => url !== null))
  .then(urls => urls.filter(url => {
    return LOCALES.some(locale => {
      return url.startsWith(`/${locale.toLowerCase()}`)
    })
  }))
  .then(urls => urls.sort())
  .then(urls => urls.map(url => `${DOMAIN}${url}`))
  .then(urls => urls.map(url => run(url)))
}


function * run(url) {
  var nightmare = new Nightmare({
    show: false,
    width: 1024,
    height: 768
  })

  var dimensions = yield nightmare.goto(url)
    .wait("body")
    .evaluate(function() {
      var body = document.querySelector("body")
      return {
        height: body.scrollHeight,
        width:body.scrollWidth
      }
    })

  console.dir(url)

  yield nightmare.viewport(dimensions.width, dimensions.height)
  .wait(1000)
  .screenshot(require("path")
  .join(__dirname, "screenshots", `${sanitize(url)}.png`))

  yield nightmare.end()
}

function handler (err) {
  return "skit"
}

(function() {
  fetchURLs()
    .then(urls => {
      vo(urls, vo.catch(handler))
        .then(out => console.log("done"))
        .catch(e => console.error(e))
    })
})()
