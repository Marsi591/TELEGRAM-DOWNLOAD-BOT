const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Telegram bot token
const TELEGRAM_TOKEN = 'YOUR BOT TOKEN';

// Initialize the bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to the Max Download Limit Exceeding Bot! Send me a file to split and send.');
});

// Handle file messages
bot.on('document', (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  // Get the file info
  bot.getFile(fileId).then((file) => {
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

    // Create the "downloads" directory if it doesn't exist
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir);
    }

    // Save the file in the "downloads" directory
    const filePath = path.join(downloadsDir, fileName);
    const fileStream = fs.createWriteStream(filePath);
    fileStream.on('finish', () => {
      // Split the file and send each part
      splitAndSendFile(chatId, filePath);
    });

    // Download the file from Telegram and save it
    https.get(fileUrl, (response) => {
      response.pipe(fileStream);
    });
  }).catch((err) => {
    console.error(err);
    bot.sendMessage(chatId, 'An error occurred while retrieving the file information.');
  });
});

// Split the file into chunks and send each part as a document
function splitAndSendFile(chatId, filePath) {
  const fileSize = fs.statSync(filePath).size;
  const chunkSize = 50 * 1024 * 1024; // 50MB (Telegram's maximum chunk size)
  const numChunks = Math.ceil(fileSize / chunkSize);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(err);
      bot.sendMessage(chatId, 'An error occurred while reading the file.');
      return;
    }

    for (let i = 0; i < numChunks; i++) {
      const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
      const partName = `part${i + 1}.dat`;

      // Save the chunk as a temporary file
      fs.writeFile(partName, chunk, (err) => {
        if (err) {
          console.error(err);
          bot.sendMessage(chatId, 'An error occurred while splitting the file.');
          return;
        }

        // Send the chunk as a document
        bot.sendDocument(chatId, partName).then(() => {
          // Delete the temporary file
          fs.unlink(partName, (err) => {
            if (err) {
              console.error(err);
            }
          });
        }).catch((err) => {
          console.error(err);
        });
      });
    }
  });
}

// Start the bot
bot.on('polling_error', (err) => {
  console.error(err);
});
