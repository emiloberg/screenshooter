const sanitizeFilename = require("sanitize-filename")
const fetch = require("node-fetch")
const Nightmare = require("nightmare")
const vo = require("vo")
const fs = require("fs-extra")
const path = require("path")
const urlModule = require("url")

// BR, NX
// const LOCALES = ["DK", "FI", "FI-SV", "FR", "DE", "GB", "IT", "MX", "NO", "ES", "SE", "NL"]
const LOCALES = ["dk", "fi", "fi-sv"]
const API_ENDPOINT = "http://kitsune.dev:3100/api/pages"
const DOMAIN = "http://inugami.dev:4000"

const folders = {}

function removeLeadingSlash(str) {
  return str.replace(/^\//, "")
}

function normalizeUrl(url) {
  return removeLeadingSlash(urlModule.parse(url).pathname)
}

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
  // .then(urls => urls.slice(0, 3))
}

function getFolderName(curUrl, links) {
  // Check if match and return
  const normalizedCurUrl = normalizeUrl(curUrl);
  if (folders.hasOwnProperty(normalizedCurUrl)) {
    return folders[normalizedCurUrl]
  }

  const urls = links
    .map(url => normalizeUrl(url))

  // Get folder name
  const kvm = {}
  urls.forEach(url => {
    const urlParts = url.split("/")
    if (urlParts.length > 1) {
      kvm[urlParts[0]] = urlParts[1]
    } else {
      kvm[urlParts[0]] = "start"
    }
  })
  var name = "default"
  if (kvm.hasOwnProperty("gb")) {
    name = kvm.gb
  } else if (kvm.hasOwnProperty("se")) {
    name = kvm.se
  }

  // Save foldernames
  urls.forEach(url => {
    folders[url] = name
  })

  return name
}

function * run(url) {
  var nightmare = new Nightmare({
    show: false,
    width: 1024,
    height: 768
  })

  var browserData = yield nightmare.goto(url)
    .wait("body")
    .evaluate(function() {
      var body = document.querySelector("body")
      var links = Array.prototype.slice.call(document.getElementsByTagName("link"))
        .filter(a => a.rel === "alternate")
        .map(a => a.href)
      return {
        height: body.scrollHeight,
        width: body.scrollWidth,
        links: links
      }
    })

  console.dir(url)

  const folderName = getFolderName(url, browserData.links)
  fs.ensureDirSync(path.join(__dirname, "screenshots", folderName))

  yield nightmare.viewport(browserData.width, browserData.height)
  .wait(1000)
  .screenshot(require("path")
  .join(__dirname, "screenshots", folderName, `${sanitize(url)}.png`))

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
