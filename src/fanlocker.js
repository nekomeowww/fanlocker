const axios = require('axios')

const cryptoObj = window.crypto || window.msCrypto
const storage = window.localStorage

const storageName = 'hexo-plugin-matataki:#' + window.location.pathname
const keySalt = textToArray('fan8AGM8uBt0Ep3oLiph')
const ivSalt = textToArray('XDUSdgPjUPWgLXnrPqtl')

const mainElement = document.getElementById('hexo-plugin-matataki')
const wrongPassMessage = mainElement.dataset['wpm']
const wrongHashMessage = mainElement.dataset['whm']
const dataElement = mainElement.getElementsByTagName('script')['hpmData']
const encryptName = mainElement.getElementsByTagName('script')['hpmName'].innerText
const encryptedData = dataElement.innerText
const HmacDigist = dataElement.dataset['hmacdigest']

function hexToArray(s) {
    return new Uint8Array(s.match(/[\da-f]{2}/gi).map((h => {
        return parseInt(h, 16)
    })))
}

function textToArray(s) {
    let i = s.length
    let n = 0
    let ba = new Array()

    for (let j = 0; j < i;) {
        let c = s.codePointAt(j)
        if (c < 128) {
            ba[n++] = c
            j++
        } else if ((c > 127) && (c < 2048)) {
            ba[n++] = (c >> 6) | 192
            ba[n++] = (c & 63) | 128
            j++
        } else if ((c > 2047) && (c < 65536)) {
            ba[n++] = (c >> 12) | 224
            ba[n++] = ((c >> 6) & 63) | 128
            ba[n++] = (c & 63) | 128
            j++
        } else {
            ba[n++] = (c >> 18) | 240
            ba[n++] = ((c >> 12) & 63) | 128
            ba[n++] = ((c >> 6) & 63) | 128
            ba[n++] = (c & 63) | 128
            j += 2
        }
    }
    return new Uint8Array(ba)
}

const queryParse = (search = window.location.search) => {
    if (!search) return {}
    const queryString = search[0] === '?' ? search.substring(1) : search
    const query = {}
    queryString
        .split('&')
        .forEach(queryStr => {
            const [key, value] = queryStr.split('=')
            if (key) query[decodeURIComponent(key)] = decodeURIComponent(value)
        })
    return query
}

function arrayBufferToHex(arrayBuffer) {
    if (typeof arrayBuffer !== 'object' || arrayBuffer === null || typeof arrayBuffer.byteLength !== 'number') {
        throw new TypeError('Expected input to be an ArrayBuffer')
    }

    let view = new Uint8Array(arrayBuffer)
    let result = ''
    let value

    for (let i = 0; i < view.length; i++) {
        value = view[i].toString(16)
        result += (value.length === 1 ? '0' + value : value)
    }

    return result
}

async function getExecutableScript(oldElem) {
    let out = document.createElement('script')
    const attList = ['type', 'text', 'src', 'crossorigin', 'defer', 'referrerpolicy']
    attList.forEach((att) => {
        if (oldElem[att])
            out[att] = oldElem[att]
    })

    return out
}

async function convertHTMLToElement(content) {
    let out = document.createElement('div')
    out.innerHTML = content
    out.querySelectorAll('script').forEach(async (elem) => {
        elem.replaceWith(await getExecutableScript(elem))
    })

    return out
}

function getKeyMaterial(password) {
    let encoder = new TextEncoder()
    return cryptoObj.subtle.importKey(
        'raw',
        encoder.encode(password),
        {
            'name': 'PBKDF2',
        },
        false,
        [
            'deriveKey',
            'deriveBits',
        ]
    )
}

function getHmacKey(keyMaterial) {
    return cryptoObj.subtle.deriveKey({
        'name': 'PBKDF2',
        'hash': 'SHA-256',
        'salt': keySalt.buffer,
        'iterations': 1024
    }, keyMaterial, {
        'name': 'HMAC',
        'hash': 'SHA-256',
        'length': 256,
    }, true, [
        'verify',
    ])
}

function getDecryptKey(keyMaterial) {
    return cryptoObj.subtle.deriveKey({
        'name': 'PBKDF2',
        'hash': 'SHA-256',
        'salt': keySalt.buffer,
        'iterations': 1024,
    }, keyMaterial, {
        'name': 'AES-CBC',
        'length': 256,
    }, true, [
        'decrypt',
    ])
}

function getIv(keyMaterial) {
    return cryptoObj.subtle.deriveBits({
        'name': 'PBKDF2',
        'hash': 'SHA-256',
        'salt': ivSalt.buffer,
        'iterations': 512,
    }, keyMaterial, 16 * 8)
}

async function verifyContent(key, content) {
    const encoder = new TextEncoder()
    const encoded = encoder.encode(content)

    let signature = hexToArray(HmacDigist)

    const result = await cryptoObj.subtle.verify({
        'name': 'HMAC',
        'hash': 'SHA-256',
    }, key, signature, encoded)
    console.log(`Verification result: ${result}`)
    if (!result) {
        alert(wrongHashMessage)
        console.log(`${wrongHashMessage}, got `, signature, ` but proved wrong.`)
    }
    return result
}

async function decrypt(decryptKey, iv, hmacKey) {
    let typedArray = hexToArray(encryptedData)

    const result = await cryptoObj.subtle.decrypt({
        'name': 'AES-CBC',
        'iv': iv,
    }, decryptKey, typedArray.buffer).then(async (result) => {
        const decoder = new TextDecoder()
        const decoded = decoder.decode(result)

        const hideButton = document.createElement('button')
        hideButton.textContent = '加密回去'
        hideButton.type = 'button'
        hideButton.classList.add("hpm-button")
        hideButton.addEventListener('click', () => {
            window.localStorage.removeItem(storageName)
            window.location.reload()
        })

        document.getElementById('hexo-plugin-matataki').style.display = 'inline'
        document.getElementById('hexo-plugin-matataki').innerHTML = ''
        document.getElementById('hexo-plugin-matataki').appendChild(await convertHTMLToElement(decoded))
        document.getElementById('hexo-plugin-matataki').appendChild(hideButton)

        // support html5 lazyload functionality.
        document.querySelectorAll('img').forEach((elem) => {
            if (elem.getAttribute("data-src") && !elem.src) {
                elem.src = elem.getAttribute('data-src')
            }
        })

        // TOC part
        let tocDiv = document.getElementById("toc-div")
        if (tocDiv) {
            tocDiv.style.display = 'inline'
        }

        let tocDivs = document.getElementsByClassName('toc-div-class')
        if (tocDivs && tocDivs.length > 0) {
            for (let idx = 0; idx < tocDivs.length; idx++) {
                tocDivs[idx].style.display = 'inline'
            }
        }

        return await verifyContent(hmacKey, decoded)
    }).catch((e) => {
        alert(wrongPassMessage)
        console.log(e)
        return false
    })

    return result
}

const queryStringify = (query) => {
    const queryString = Object.keys(query)
        .map(key => `${key}=${encodeURIComponent(query[key] || '')}`)
        .join('&')
    return queryString
}

const disassemble = (token) => {
    if (!token) return { iss: null, exp: 0, platform: null, id: null }
    let tokenPayload = token.substring(token.indexOf('.') + 1)
    tokenPayload = tokenPayload.substring(0, tokenPayload.indexOf('.'))
    return JSON.parse(atob(tokenPayload))
}

const getUserProfile = (uid) => {
    return axios.get('https://api.smartsignature.io' + `/user/${uid}`)
}

const convertDecimals = (amount, decimal) => {
    const move = 10 ** parseInt(decimal)
    const result = parseInt(amount) / move
    return result
}

const de = (token, tokenAmount, clientId, clientSecret, vaultName) => {
    let hold = convertDecimals(token.amount, token.decimals)
    const oldStorageData = JSON.parse(storage.getItem(storageName))

    if (oldStorageData) {
        console.log(`Password got from localStorage(${storageName}): `, oldStorageData)

        const sIv = hexToArray(oldStorageData.iv).buffer
        const sDk = oldStorageData.dk
        const sHmk = oldStorageData.hmk

        cryptoObj.subtle.importKey('jwk', sDk, {
            'name': 'AES-CBC',
            'length': 256,
        }, true, [
            'decrypt',
        ]).then((dkCK) => {
            cryptoObj.subtle.importKey('jwk', sHmk, {
                'name': 'HMAC',
                'hash': 'SHA-256',
                'length': 256,
            }, true, [
                'verify',
            ]).then((hmkCK) => {
                decrypt(dkCK, sIv, hmkCK).then((result) => {
                    if (!result) {
                        storage.removeItem(storageName)
                    }
                })
            })
        })
    }
    if (hold >= tokenAmount) {
        axios.get('https://developer.matataki.io/api/app/vaultbyname?clientId=' + clientId + '&clientSecret=' + clientSecret + '&name=' + vaultName).then(async res => {
            let password = res.data.value
            const keyMaterial = await getKeyMaterial(password)
            const hmacKey = await getHmacKey(keyMaterial)
            const decryptKey = await getDecryptKey(keyMaterial)
            const iv = await getIv(keyMaterial)

            decrypt(decryptKey, iv, hmacKey).then((result) => {
                console.log(`Decrypt result: ${result}`)
                if (result) {
                    cryptoObj.subtle.exportKey('jwk', decryptKey).then((dk) => {
                        cryptoObj.subtle.exportKey('jwk', hmacKey).then((hmk) => {
                            const newStorageData = {
                                'dk': dk,
                                'iv': arrayBufferToHex(iv),
                                'hmk': hmk,
                            }
                            storage.setItem(storageName, JSON.stringify(newStorageData))
                        })
                    })
                }
            })
        })
    }
}

const getCookie = (cname) => {
    var name = cname + "="
    var decodedCookie = decodeURIComponent(document.cookie)
    var ca = decodedCookie.split(';')
    for(var i = 0; i < ca.length; i++) {
      var c = ca[i]
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length)
      }
    }
    return ""
}

class FanLocker {
    constructor({ clientId, clientSecret }) {
        this.clientId = clientId
        this.clientSecret = clientSecret

        axios.post(`https://developer.matataki.io/api/app/oauth`, { clientId: clientId, clientSecret: clientSecret, redirect_uri: `${window.location.origin}${window.location.pathname}?callback=true` })
        let query = queryParse()
        let cookie = getCookie('matataki_token')
        let result = disassemble(cookie)
        if (cookie && Date.now() < result.exp) {
            query.token = cookie
        }
        else {
            document.cookie = 'matataki_token=; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        }
        this.tokenId = parseInt(mainElement.getElementsByTagName('script')['hpmToken'].innerText)
        this.tokenAmount = parseInt(mainElement.getElementsByTagName('script')['hpmAmount'].innerText)
        this.vaultName = mainElement.getElementsByTagName('script')['hpmName'].innerText
        if (query.token) {

            document.getElementById('login-btn').style.display = 'none'
            document.getElementById('unlock-btn').style.display = 'inline'

            let user = disassemble(query.token)
            document.cookie='matataki_token=' + query.token
            getUserProfile(user.id).then(res => {
                let userProfile = res.data.data
                axios({
                    url: 'https://api.smartsignature.io/token/tokenlist?pagesize=999&order=0&page=1',
                    method: 'GET',
                    headers: { 'x-access-token': query.token }
                }).then(res => {
                    let wallet = res.data.data.list
                    let targetToken = wallet.filter(fan => fan.token_id === this.tokenId)
                    this.token = targetToken.pop()
                    let btn = document.getElementById('unlock-btn')
                    btn.addEventListener('click', () => {
                        de(this.token, this.tokenAmount, clientId, clientSecret, this.vaultName)
                        history.replaceState(null, null, `${window.location.origin}${window.location.pathname}`)
                    })
                })
            })
        }
    }
}

module.exports = FanLocker