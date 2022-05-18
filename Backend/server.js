import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import multer from 'multer'
import GridFsStorage from 'multer-gridfs-storage'
//Grid fs stream, renders images to the users
import Grid from 'gridfs-stream'
import bodyParser from 'body-parser'
import path from 'path'
import Pusher from 'pusher' 
import mongoPosts from './mongoPosts.js'

Grid.mongo = mongoose.mongo

// app config
const app = express()
const port = process.env.PORT || 7000;

const pusher = new Pusher({ 
    appId: "1243073",
    key: "a3372ba0676d1970b6e8",
    secret: "b0f0b974b70710b1c0ac",
    cluster: "eu", 
    useTLS: true
  });
//middle wears
app.use(bodyParser.json());
app.use(cors())
// console.log(pusher);
// DB  config
const mongoURI = 'mongodb+srv://admin:zbgThH1ataBcffzs@cluster0.xfphp.mongodb.net/fbdbretryWrites=true&w=majority'

const conn = mongoose.createConnection(mongoURI,{
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
}); 

mongoose.connection.once('open', ()=>{ 
    console.log('DB CONNECTED!!!')

    const changeStream = mongoose.connection.collection('posts').watch()
    changeStream.on('change', (change)=>{
        console.log(change)
        if(change.operationType==='insert'){
            console.log('Tiggering Pusher')

            pusher.trigger('posts', 'inserted', {
                change: change
            })
        }else{
            console.log('Error triggering Pusher')
        }
    })
})

mongoose.connect(mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
});
 
let gfs

conn.once('open', ()=>{
    console.log('DB CONNECTED!!!')
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('images')
})

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file)=>{
        return new Promise ((resolve, reject)=>{{
            const filename = `image-${Date.now()}${path.extname(file.originalname)}`
            const fileInfo={
                filename: filename,
            
                bucketName: 'images'
            } 
            resolve(fileInfo)
            }
        })
    }
})
// File upload system using middle wear
const upload = multer({storage})
// api route
app.get('/', (req, res)=>res.status(200).send('Hello world'))

app.post('/upload/image', upload.single('file'), (req, res)=>{
    res.status(201).send(req.file)
    console.log(req.file)
})

app.post('/upload/posts', (req, res)=>{
    const dbPost = req.body
//create  new doc in collection 
    mongoPosts.create(dbPost, (err, data)=>{
        if(err){ 
            res.status(500).send(err)
        }else{
            res.status(201).send(data) 
        }
    })
})
// Returning image back to front end! 
app.get('/retrieve/image/single',(req, res)=>{
    gfs.files.findOne({filename: req.query.name}, (err, file)=>{
        
        if(err){
            res.status(500).send(err)
        }else{
            if (!file||file.length ===0){
                res.status(404).json({err:'file not found'})
            }else{//Reading file out of gfs and grab file
                const readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            }
        }
    })
})

app.get('/api/retrieve/posts', (req, res)=>{
// match up the posts and images
    mongoPosts.find((err,data)=>{
        if(err){
            res.status(500).send(err)
        }else{
            data.sort((b,a)=>{
                return a.timestamp - b.timestamp;
            });
            res.status(200).send(data)
        }
    })
})

app.listen(port, ()=>console.log(`listening on localhost:${port}`))


