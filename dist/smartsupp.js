/**
 * Smartsupp live chat bootstrap.
 *
 * Kept in a local file instead of an inline <script> so the production Content
 * Security Policy can stay strict (no `unsafe-inline` for scripts). Smartsupp's
 * own domains are allowlisted in vercel.json and netlify.toml.
 */
(function () {
  var smartsuppConfig = (window._smartsupp = window._smartsupp || {})
  smartsuppConfig.key = '3dd1775ef1b7a3fbdca82a5ed337aabf83fc4950'

  if (window.smartsupp) return

  var script
  var loader = document.createElement('script')
  var queue = (window.smartsupp = function () {
    queue._.push(arguments)
  })
  queue._ = []

  loader.type = 'text/javascript'
  loader.charset = 'utf-8'
  loader.async = true
  loader.src = 'https://www.smartsuppchat.com/loader.js?'

  script = document.getElementsByTagName('script')[0]
  if (script && script.parentNode) {
    script.parentNode.insertBefore(loader, script)
  } else {
    document.head.appendChild(loader)
  }
})()
