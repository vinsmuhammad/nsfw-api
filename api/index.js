import * as nsfwjs from 'nsfwjs'
import * as tf from '@tensorflow/tfjs-node'
import sharp from 'sharp'

let model

// load model sekali per instance
async function getModel() {
  if (!model) {
    model = await nsfwjs.load()
    console.log("✅ NSFWJS model loaded")
  }
  return model
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html')
      return res.end(`
        <html>
          <head><title>NSFW API</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:30px;">
            <h2>🚀 NSFWJS API</h2>
            <p>Upload gambar untuk cek NSFW</p>
            <form method="POST" enctype="multipart/form-data" action="/api">
              <input type="file" name="file" accept="image/*" required />
              <button type="submit">Upload & Check</button>
            </form>
          </body>
        </html>
      `)
    }

    if (req.method === 'POST') {
      let body = []
      for await (const chunk of req) body.push(chunk)
      const rawData = Buffer.concat(body).toString()

      // JSON request dengan { imageBase64 }
      try {
        const { imageBase64 } = JSON.parse(rawData)
        if (imageBase64) return await processImage(res, imageBase64)
      } catch {}

      // upload form multipart (dari browser)
      const match = rawData.match(/base64,(.*)"/)
      if (match) return await processImage(res, match[1])

      return res.status(400).json({ error: 'Invalid upload' })
    }

    res.status(405).json({ error: 'Only GET/POST allowed' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

async function processImage(res, imageBase64) {
  const buf = Buffer.from(imageBase64, 'base64')
  const resized = await sharp(buf).resize(224, 224).toBuffer()
  const tensor = tf.node.decodeImage(resized, 3).expandDims(0)

  const mdl = await getModel()
  const predictions = await mdl.classify(tensor)
  tensor.dispose()

  return res.status(200).json({ predictions })
}