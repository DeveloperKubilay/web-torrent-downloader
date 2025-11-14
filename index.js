const torrentStream = require('torrent-stream');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

const upload = multer({ dest: 'uploads/' });

let stats = {
    name: '',
    progress: 0,
    speed: 0,
    peers: 0,
    downloaded: 0,
    total: 0,
    eta: 'hesaplanıyor',
    status: 'bekliyor',
    isDone: false
};

let engine = null;

function startTorrent(torrentPath) {
    if (engine) {
        engine.destroy();
    }

    stats = {
        name: '',
        progress: 0,
        speed: 0,
        peers: 0,
        downloaded: 0,
        total: 0,
        eta: 'hesaplanıyor',
        status: 'başlatılıyor',
        isDone: false
    };

    engine = torrentStream(fs.readFileSync(torrentPath), {
        path: __dirname
    });

    engine.on('ready', () => {
        stats.name = engine.torrent.name;
        stats.total = engine.torrent.length;
        stats.status = 'indiriliyor';
        console.log(`✅ Torrent başladı: ${engine.torrent.name}`);
        
        engine.files.forEach(file => {
            file.select();
        });
        
        let lastProgress = 0;
        const interval = setInterval(() => {
            const downloaded = engine.swarm.downloaded;
            const total = engine.torrent.length;
            const progress = ((downloaded / total) * 100).toFixed(2);
            const speed = ((downloaded - lastProgress) / 1024 / 1024).toFixed(2);
            
            const remaining = total - downloaded;
            const speedBytes = downloaded - lastProgress;
            const eta = speedBytes > 0 ? remaining / speedBytes : 0;
            const etaMinutes = Math.floor(eta / 60);
            const etaSeconds = Math.floor(eta % 60);
            const etaText = etaMinutes > 0 ? `${etaMinutes}dk ${etaSeconds}sn` : `${etaSeconds}sn`;
            
            stats.downloaded = downloaded;
            stats.progress = parseFloat(progress);
            stats.speed = parseFloat(speed);
            stats.peers = engine.swarm.wires.length;
            stats.eta = eta > 0 ? etaText : 'hesaplanıyor';
            
            lastProgress = downloaded;
            
            process.stdout.write(`\r📥 İndiriliyor: ${progress}% | Hız: ${speed} MB/s | Peers: ${engine.swarm.wires.length} | Kalan: ${etaText}`);
            
            if (downloaded >= total) {
                clearInterval(interval);
                stats.status = 'tamamlandı';
                stats.isDone = true;
                console.log('\n🎉 İndirme tamamlandı!');
                console.log(`📂 Konum: ${__dirname}`);
                fs.writeFileSync(path.join(__dirname, 'download_complete.txt'), `İndirme tamamlandı: ${engine.torrent.name}\nKonum: ${__dirname}\n`);
                engine.destroy();
            }
        }, 1000);
    });

    engine.on('error', (err) => {
        stats.status = 'hata';
        console.error('❌ Hata:', err.message);
    });
}

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.get('/torrent/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/torrent/upload', upload.single('torrent'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Dosya yok' });
    }
    
    startTorrent(req.file.path);
    res.json({ success: true, message: 'Torrent başladı' });
});

app.get('/torrent/status', (req, res) => {
    res.json({
        torrent: stats.name,
        progress: `${stats.progress}%`,
        speed: `${stats.speed} MB/s`,
        peers: stats.peers,
        downloaded: `${(stats.downloaded / 1024 / 1024).toFixed(2)} MB`,
        total: `${(stats.total / 1024 / 1024).toFixed(2)} MB`,
        eta: stats.eta || 'hesaplanıyor',
        status: stats.status,
        isDone: stats.isDone
    });
});

app.listen(process.env.PORT || 3000, () => {
    const port = process.env.PORT || 3000;
    console.log(`🚀 Arayüz: http://localhost:${port}/torrent/`);
    console.log(`📊 API: http://localhost:${port}/torrent/status`);
});
