require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// Fayllarni yuklash
const books = require("./books.json");
const ads = require("./ads.json");

// Konfiguratsiya
const TOKEN = process.env.BOT_TOKEN;
const MONITORING_TOKEN = process.env.MONITORING_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_ID.split(",").map((id) => id.trim());
const MONITORING_CHAT_ID = process.env.MONITORING_CHAT_ID;
const REQUIRED_CHANNELS = [
  { id: "@ElektronkitoblarElektornkutubxon", link: "https://t.me/ElektronkitoblarElektornkutubxon" },
  { id: "@KinolarTarjimaFantastikYangiKino", link: "https://t.me/KinolarTarjimaFantastikYangiKino" }
];

// Botlarni yaratish
const bot = new TelegramBot(TOKEN, { polling: true });
const monitoringBot = new TelegramBot(MONITORING_TOKEN, { polling: true });

// Fayllarni tekshirish va yaratish
const filesToCheck = [
  { path: "users.json", default: [] },
  { path: "books.json", default: [] },
  { path: "ads.json", default: [] }
];

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file.path);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(file.default, null, 2));
  }
});

// Ma'lumotlarni yuklash
let users = require("./users.json");
const monitoringMessages = new Map();

// Vaqtinchalik ma'lumotlar
const waitingForBook = {};
const waitingForAd = {};

// Tarjimalar
const translations = {
  uz: {
    welcome: "Assalomu alaykum! Kitoblar botimizga xush kelibsiz. Quyidagi menyulardan foydalaning:",
    languageSelected: "Til tanlandi!",
    chooseLanguage: "Tilni tanlang:",
    noPermission: "❌ Sizda bunday buyruqni bajarish huquqi yo'q.",
    bookNotFound: "❌ Kitob topilmadi.",
    back: "🔙 Orqaga",
    mainMenu: "🏠 Asosiy menyu",
    searchBook: "📚 Kitob qidirish",
    allBooks: "📂 Barcha kitoblar",
    settings: "⚙️ Sozlamalar",
    contactInfo: "Adminlar bilan bog'lanish uchun:\n📞 Telefon: +998974634455\n📲 Telegram: @Sadikov001",
    bookAdded: "✅ Kitob qo'shildi!",
    adSent: "✅ Reklama yuborildi!",
    adCanceled: "❌ Reklama bekor qilindi.",
    addMethod: "Kitob qo'shish usulini tanlang:",
    manualEntry: "📝 Qo'lda kiritish",
    autoEntry: "📂 Fayl nomidan olish",
    enterBookName: "📖 Kitob nomini kiriting:",
    enterAuthor: "✍️ Muallif nomini kiriting:",
    sendCover: "🖼 Kitob uchun rasm yuboring:",
    sendFiles: "📄 Kitob fayllarini yuboring (PDF, EPUB, etc.):",
    fileReceived: "📄 Fayl qabul qilindi:",
    moreFiles: "Yana fayl yuborishingiz mumkin yoki \"Tayyor\" tugmasini bosing",
    chooseGenre: "📂 Janrni tanlang:",
    booksAdded: "✅ {count} ta kitob qo'shildi!\n👤 Muallif: {author}\n📂 Janr: {genre}",
    noFiles: "❌ Hech qanday fayl yuborilmadi!",
    changeLanguage: "🌐 Tilni o'zgartirish",
    languageChanged: "✅ Til muvaffaqiyatli o'zgartirildi!",
    notSubscribed: "⚠️ Botdan foydalanish uchun quyidagi kanallarga a'zo bo'lishingiz kerak:",
    checkSubscription: "✅ A'zolikni tekshirish",
    subscribed: "✅ Siz kanal(lar)ga a'zo bo'lgansiz! Endi botdan foydalanishingiz mumkin.",
    stillNotSubscribed: "❌ Siz hali kanal(lar)ga a'zo bo'lmagansiz. Iltimos, a'zo bo'ling va \"A'zolikni tekshirish\" tugmasini bosing.",
    author: "Muallif",
    genre: "Janr"
  },
  ru: {
    welcome: "Добро пожаловать в бота с книгами! Пожалуйста, используйте меню ниже:",
    languageSelected: "Язык выбран!",
    chooseLanguage: "Выберите язык:",
    noPermission: "❌ У вас нет прав для выполнения этой команды.",
    bookNotFound: "❌ Книга не найдена.",
    back: "🔙 Назад",
    mainMenu: "🏠 Главное меню",
    searchBook: "📚 Поиск книги",
    allBooks: "📂 Все книги",
    settings: "⚙️ Настройки",
    contactInfo: "Для связи с администраторами:\n📞 Телефон: +998974634455\n📲 Telegram: @Sadikov001",
    bookAdded: "✅ Книга добавлена!",
    adSent: "✅ Реклама отправлена!",
    adCanceled: "❌ Реклама отменена.",
    addMethod: "Выберите способ добавления книги:",
    manualEntry: "📝 Ручной ввод",
    autoEntry: "📂 Из имени файла",
    enterBookName: "📖 Введите название книги:",
    enterAuthor: "✍️ Введите имя автора:",
    sendCover: "🖼 Отправьте обложку для книги:",
    sendFiles: "📄 Отправьте файлы книги (PDF, EPUB и т.д.):",
    fileReceived: "📄 Файл получен:",
    moreFiles: "Вы можете отправить еще файлы или нажать кнопку \"Готово\"",
    chooseGenre: "📂 Выберите жанр:",
    booksAdded: "✅ Добавлено {count} книг!\n👤 Автор: {author}\n📂 Жанр: {genre}",
    noFiles: "❌ Файлы не отправлены!",
    changeLanguage: "🌐 Изменить язык",
    languageChanged: "✅ Язык успешно изменен!",
    notSubscribed: "⚠️ Для использования бота необходимо подписаться на следующие каналы:",
    checkSubscription: "✅ Проверить подписку",
    subscribed: "✅ Вы подписаны на канал(ы)! Теперь вы можете использовать бота.",
    stillNotSubscribed: "❌ Вы еще не подписались на канал(ы). Пожалуйста, подпишитесь и нажмите кнопку \"Проверить подписку\".",
    author: "Автор",
    genre: "Жанр"
  },
  en: {
    welcome: "Welcome to the Books Bot! Please use the menu below:",
    languageSelected: "Language selected!",
    chooseLanguage: "Choose language:",
    noPermission: "❌ You don't have permission to execute this command.",
    bookNotFound: "❌ Book not found.",
    back: "🔙 Back",
    mainMenu: "🏠 Main menu",
    searchBook: "📚 Search book",
    allBooks: "📂 All books",
    settings: "⚙️ Settings",
    contactInfo: "To contact admins:\n📞 Phone: +998974634455\n📲 Telegram: @Sadikov001",
    bookAdded: "✅ Book added!",
    adSent: "✅ Ad sent!",
    adCanceled: "❌ Ad canceled.",
    addMethod: "Choose book adding method:",
    manualEntry: "📝 Manual entry",
    autoEntry: "📂 From filename",
    enterBookName: "📖 Enter book name:",
    enterAuthor: "✍️ Enter author name:",
    sendCover: "🖼 Send cover image for the book:",
    sendFiles: "📄 Send book files (PDF, EPUB, etc.):",
    fileReceived: "📄 File received:",
    moreFiles: "You can send more files or press \"Done\" button",
    chooseGenre: "📂 Choose genre:",
    booksAdded: "✅ Added {count} books!\n👤 Author: {author}\n📂 Genre: {genre}",
    noFiles: "❌ No files sent!",
    changeLanguage: "🌐 Change language",
    languageChanged: "✅ Language changed successfully!",
    notSubscribed: "⚠️ To use the bot, you must subscribe to these channels:",
    checkSubscription: "✅ Check subscription",
    subscribed: "✅ You're subscribed to the channel(s)! Now you can use the bot.",
    stillNotSubscribed: "❌ You're still not subscribed to the channel(s). Please subscribe and press \"Check subscription\" button.",
    author: "Author",
    genre: "Genre"
  }
};

// Asosiy funksiyalar

// Ma'lumotlarni saqlash
function saveData(filename, data) {
  try {
    fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Failed to save ${filename}:`, error);
  }
}

// Foydalanuvchi qo'shish
function addUser(user) {
  try {
    const existingUser = users.find(u => u.id === user.id);
    if (!existingUser) {
      users.push({
        id: user.id,
        username: user.username || null,
        first_name: user.first_name,
        last_name: user.last_name || null,
        language: 'uz',
        joined_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        subscribed: false
      });
      saveData("users.json", users);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Foydalanuvchi qo'shishda xato:", error);
    return false;
  }
}

// Foydalanuvchi faolligini yangilash
function updateUserActivity(userId, action) {
  try {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].last_active = new Date().toISOString();
      saveData("users.json", users);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Foydalanuvchi faolligini yangilashda xato:", error);
    return false;
  }
}

// Kitob qo'shish
function addBook(bookData) {
  try {
    const newBook = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000),
      name: bookData.name,
      author: bookData.author || "Noma'lum",
      genre: bookData.genre || "Boshqa",
      file_id: bookData.file_id || null,
      file_type: bookData.file_type || null,
      image_id: bookData.image_id || null,
      added_at: new Date().toISOString()
    };

    books.push(newBook);
    saveData("books.json", books);
    return newBook;
  } catch (error) {
    console.error("Kitob qo'shishda xato:", error);
    return null;
  }
}

// Reklama yuborish
async function broadcastAd(ad) {
  try {
    for (const user of users) {
      try {
        if (ad.file_id) {
          const options = { 
            caption: ad.text,
            parse_mode: "Markdown"
          };

          if (ad.file_type === "photo") {
            await bot.sendPhoto(user.id, ad.file_id, options);
          } else if (ad.file_type === "video") {
            await bot.sendVideo(user.id, ad.file_id, options);
          } else if (ad.file_type === "document") {
            await bot.sendDocument(user.id, ad.file_id, options);
          }
        } else {
          await bot.sendMessage(user.id, ad.text, { parse_mode: "Markdown" });
        }

        updateUserActivity(user.id, "Reklama olindi");
      } catch (error) {
        console.error(`Foydalanuvchiga reklama yuborishda xato ${user.id}:`, error.message);
      }
    }
    return true;
  } catch (error) {
    console.error("Reklama yuborishda xato:", error);
    return false;
  }
}

// Kanalga a'zolikni tekshirish
async function checkSubscriptions(userId) {
  try {
    for (const channel of REQUIRED_CHANNELS) {
      const member = await bot.getChatMember(channel.id, userId);
      if (member.status === 'left' || member.status === 'kicked') {
        return false;
      }
    }
    
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].subscribed = true;
      saveData("users.json", users);
    }
    
    return true;
  } catch (error) {
    console.error("A'zolikni tekshirishda xato:", error);
    return false;
  }
}

// Monitoring ma'lumotlari
async function sendMonitoringInfo(action, user, additionalData = {}) {
  try {
    const now = new Date();
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';
    
    let message = `👤 *User:* ${user.first_name} ${user.last_name || ''} (@${user.username || 'N/A'})\n`;
    message += `🆔 *ID:* ${user.id}\n`;
    message += `📅 *Joined:* ${new Date(userObj.joined_at || now).toLocaleDateString()}\n`;
    message += `⏰ *Last active:* ${now.toLocaleString()}\n`;
    message += `✅ *Subscribed:* ${userObj.subscribed ? 'Yes' : 'No'}\n\n`;
    message += `📌 *Action:* ${action}\n`;

    if (Object.keys(additionalData).length > 0) {
      message += `\n📊 *Details:* \`\`\`${JSON.stringify(additionalData, null, 2)}\`\`\`\n`;
    }

    if (monitoringMessages.has(user.id)) {
      try {
        const msgId = monitoringMessages.get(user.id);
        await monitoringBot.editMessageText(message, {
          chat_id: MONITORING_CHAT_ID,
          message_id: msgId,
          parse_mode: 'Markdown'
        });
      } catch (editError) {
        console.error("Xabarni yangilashda xato:", editError);
        const newMsg = await monitoringBot.sendMessage(
          MONITORING_CHAT_ID, 
          message, 
          { parse_mode: 'Markdown' }
        );
        monitoringMessages.set(user.id, newMsg.message_id);
      }
    } else {
      const newMsg = await monitoringBot.sendMessage(
        MONITORING_CHAT_ID, 
        message, 
        { parse_mode: 'Markdown' }
      );
      monitoringMessages.set(user.id, newMsg.message_id);
    }
  } catch (error) {
    console.error("Monitoringda xato:", error);
  }
}

// Uzun xabarlarni yuborish
async function sendLongMessage(chatId, text, options = {}) {
  try {
    const maxLength = 4096;
    if (text.length <= maxLength) {
      await bot.sendMessage(chatId, text, options);
      return;
    }

    const parts = [];
    let currentPart = "";
    
    const lines = text.split('\n');
    for (const line of lines) {
      if (currentPart.length + line.length + 1 > maxLength) {
        parts.push(currentPart);
        currentPart = line;
      } else {
        currentPart += (currentPart ? '\n' : '') + line;
      }
    }
    
    if (currentPart) {
      parts.push(currentPart);
    }

    for (let i = 0; i < parts.length; i++) {
      const partOptions = i === parts.length - 1 ? options : {};
      await bot.sendMessage(chatId, parts[i], partOptions);
    }
  } catch (error) {
    console.error("Uzun xabar yuborishda xato:", error);
    throw error;
  }
}

// Kitob nomini formatlash
function formatBookName(name) {
  return name
    .replace(/[*_\[\]()~`>#+\-=|{}.!]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kitoblar ro'yxatini formatlash
function formatBookList(books) {
  return books.map(book => ({
    ...book,
    name: formatBookName(book.name),
    author: formatBookName(book.author || "Noma'lum")
  }));
}

// Asosiy menyu
function getMainMenu(userLanguage = 'uz') {
  return {
    reply_markup: {
      keyboard: [
        [translations[userLanguage].searchBook],
        [translations[userLanguage].allBooks],
        [translations[userLanguage].settings],
      ],
      resize_keyboard: true,
    },
  };
}

// Orqaga menyusi
function getBackMenu(userLanguage = 'uz') {
  return {
    reply_markup: {
      keyboard: [
        [translations[userLanguage].back],
        [translations[userLanguage].mainMenu],
      ],
      resize_keyboard: true,
    },
  };
}

// A'zolik menyusi
function getSubscriptionMenu(userLanguage = 'uz') {
  const buttons = REQUIRED_CHANNELS.map(channel => ({
    text: `📢 ${channel.id}`,
    url: channel.link
  }));
  
  buttons.push({ text: translations[userLanguage].checkSubscription, callback_data: "check_subscription" });
  
  return {
    reply_markup: {
      inline_keyboard: [
        buttons,
        [{ text: translations[userLanguage].back, callback_data: "back_to_main" }]
      ]
    }
  };
}

// Til menyusi
const languageMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" }],
      [{ text: "🇷🇺 Русский", callback_data: "lang_ru" }],
      [{ text: "🇬🇧 English", callback_data: "lang_en" }]
    ],
  },
};

// Janr menyusi
function getGenreMenu(userLanguage = 'uz', prefix = "genre_") {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Badiiy", callback_data: `${prefix}Badiiy` }, { text: "Ilmiy", callback_data: `${prefix}Ilmiy` }],
        [{ text: "Detektiv", callback_data: `${prefix}Detektiv` }, { text: "🌐 Jahon adabiyoti", callback_data: `${prefix}🌐 Jahon adabiyoti` }],
        [{ text: "Darslik", callback_data: `${prefix}Darslik` }, { text: "Boshqa", callback_data: `${prefix}Boshqa` }],
        [{ text: "Shaxsiy Rivojlanish", callback_data: `${prefix}Shaxsiy Rivojlanish` }],
        [{ text: "Podkast", callback_data: `${prefix}Podkast` }],
        [{ text: "Audio Dars", callback_data: `${prefix}Audio Dars` }],
        [{ text: "All", callback_data: `${prefix}all` }],
        [{ text: translations[userLanguage].back, callback_data: "back_to_main" }],
      ],
    },
  };
}

// Kitoblar ro'yxatini ko'rsatish
async function showBooksByGenre(chatId, genre, userLanguage = 'uz') {
  try {
    let filteredBooks = genre === "all" 
      ? books 
      : books.filter(b => b.genre === genre);
    
    if (filteredBooks.length === 0) {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].bookNotFound,
        getBackMenu(userLanguage)
      );
      return;
    }
    
    const formattedBooks = formatBookList(filteredBooks);
    const chunkSize = 10;
    
    for (let i = 0; i < formattedBooks.length; i += chunkSize) {
      const chunk = formattedBooks.slice(i, i + chunkSize);
      let message = `📚 ${translations[userLanguage].allBooks} (${genre}):\n\n`;
      
      chunk.forEach((book, index) => {
        message += `${i + index + 1}. *${book.name}*\n`;
        message += `👤 ${translations[userLanguage].author}: ${book.author}\n`;
        message += `📂 ${translations[userLanguage].genre}: ${book.genre}\n`;
        message += `🆔 ID: ${book.id}\n\n`;
      });
      
      await sendLongMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ 
              text: translations[userLanguage].back, 
              callback_data: "back_to_main" 
            }]
          ]
        }
      });
    }
  } catch (error) {
    console.error("Kitoblarni ko'rsatishda xato:", error);
    await bot.sendMessage(
      chatId, 
      "❌ Kitoblarni ko'rsatishda xatolik yuz berdi",
      getBackMenu(userLanguage)
    );
  }
}

// Kitob qidirish
async function searchBooks(chatId, query, userLanguage = 'uz') {
  try {
    const results = books.filter(
      b => b.id === query || 
           b.name.toLowerCase().includes(query.toLowerCase()) || 
           b.author?.toLowerCase().includes(query.toLowerCase()) || 
           b.genre?.toLowerCase().includes(query.toLowerCase())
    );

    if (results.length) {
      for (const book of results) {
        let caption = `📖 *${formatBookName(book.name)}*\n`;
        caption += `👤 *${translations[userLanguage].author}:* ${formatBookName(book.author || "Noma'lum")}\n`;
        caption += `📂 *${translations[userLanguage].genre}:* ${book.genre}\n\n`;
        caption += `${REQUIRED_CHANNELS[0].link}`;
        
        if (book.file_id) {
          const options = { 
            caption, 
            parse_mode: "Markdown",
            reply_markup: getBackMenu(userLanguage).reply_markup
          };

          switch(book.file_type) {
            case "document":
              await bot.sendDocument(chatId, book.file_id, options);
              break;
            case "photo":
              await bot.sendPhoto(chatId, book.file_id, options);
              break;
            case "video":
              await bot.sendVideo(chatId, book.file_id, options);
              break;
            case "audio":
              await bot.sendAudio(chatId, book.file_id, options);
              break;
            case "voice":
              await bot.sendVoice(chatId, book.file_id, options);
              break;
          }
        } else {
          await bot.sendMessage(
            chatId, 
            `⚠️ ${formatBookName(book.name)} mavjud, lekin fayli yo'q.`, 
            { 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(userLanguage).reply_markup
            }
          );
        }
      }
    } else {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].bookNotFound,
        getBackMenu(userLanguage)
      );
    }
  } catch (error) {
    console.error("Kitob qidirishda xato:", error);
    await bot.sendMessage(
      chatId, 
      "❌ Kitob qidirishda xatolik yuz berdi",
      getBackMenu(userLanguage)
    );
  }
}

// /start komandasi
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;

    const isNewUser = addUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name
    });

    if (isNewUser) {
      sendMonitoringInfo("New user added", user);
    }

    const isSubscribed = await checkSubscriptions(user.id);
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    if (!isSubscribed) {
      let message = translations[userLanguage].notSubscribed + "\n\n";
      REQUIRED_CHANNELS.forEach(channel => {
        message += `- ${channel.link}\n`;
      });
      
      await bot.sendMessage(
        chatId, 
        message,
        getSubscriptionMenu(userLanguage)
      );
      return;
    }

    if (isNewUser) {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].chooseLanguage,
        languageMenu
      );
    } else {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].welcome, 
        getMainMenu(userLanguage)
      );
    }
    
    updateUserActivity(user.id, "Started the bot");
  } catch (error) {
    console.error("/start command error:", error);
  }
});

// Callback query handler
bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const user = query.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';
    const data = query.data;

    if (data === "check_subscription") {
      const isSubscribed = await checkSubscriptions(user.id);
      
      if (isSubscribed) {
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].subscribed,
          getMainMenu(userLanguage)
        );
      } else {
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].stillNotSubscribed,
          getSubscriptionMenu(userLanguage)
        );
      }
      
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("lang_")) {
      const lang = data.replace("lang_", "");
      const userIndex = users.findIndex(u => u.id === user.id);
      
      if (userIndex !== -1) {
        users[userIndex].language = lang;
        saveData("users.json", users);
        
        await bot.sendMessage(
          chatId, 
          translations[lang].languageChanged, 
          getMainMenu(lang)
        );
        
        await bot.answerCallbackQuery(query.id, {
          text: translations[lang].languageSelected
        });
        
        updateUserActivity(user.id, `Changed language to ${lang}`);
      }
      return;
    }

    if (data.startsWith("genre_")) {
      const genre = data.replace("genre_", "");
      await showBooksByGenre(chatId, genre, userLanguage);
      await bot.answerCallbackQuery(query.id);
      updateUserActivity(user.id, `Viewed ${genre} genre books`);
      return;
    }

    if (data.startsWith("book_genre_")) {
      const genre = data.replace("book_genre_", "");
      
      if (waitingForBook[chatId] && waitingForBook[chatId].mode === "auto") {
        let addedCount = 0;
        
        for (const file of waitingForBook[chatId].files) {
          let bookName = file.file_name.replace(/\.[^/.]+$/, "")
                             .replace(/[_-]/g, " ")
                             .trim();
          
          bookName = bookName.split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');

          const newBook = addBook({
            name: bookName,
            author: waitingForBook[chatId].author,
            genre: genre,
            file_id: file.file_id,
            file_type: file.file_type,
            image_id: waitingForBook[chatId].image_id
          });
          
          if (newBook) addedCount++;
        }
        
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].booksAdded
            .replace("{count}", addedCount)
            .replace("{author}", waitingForBook[chatId].author)
            .replace("{genre}", genre),
          getMainMenu(userLanguage)
        );
      } else if (waitingForBook[chatId]) {
        waitingForBook[chatId].genre = genre;
        waitingForBook[chatId].step = "waiting_for_book_file";

        await bot.sendMessage(
          chatId, 
          translations[userLanguage].sendCover,
          getBackMenu(userLanguage)
        );
      }
      
      delete waitingForBook[chatId];
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === "confirm_ad") {
      const adId = Date.now().toString();

      const newAd = {
        id: adId,
        text: waitingForAd[chatId].text,
        file_id: waitingForAd[chatId].file_id,
        file_type: waitingForAd[chatId].file_type,
        created_at: new Date().toISOString(),
      };

      ads.push(newAd);
      saveData("ads.json", ads);

      await broadcastAd(newAd);

      await bot.sendMessage(
        chatId, 
        translations[userLanguage].adSent,
        getMainMenu(userLanguage)
      );

      delete waitingForAd[chatId];
      updateUserActivity(user.id, "Confirmed ad");
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === "cancel_ad") {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].adCanceled,
        getMainMenu(userLanguage)
      );
      delete waitingForAd[chatId];
      updateUserActivity(user.id, "Canceled ad");
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === "download_users") {
      try {
        const csvContent = "ID,Username,First Name,Last Name,Language,Joined At,Last Active,Subscribed\n" +
          users.map(user => 
            `${user.id},${user.username || ''},${user.first_name},${user.last_name || ''},${user.language || 'uz'},${user.joined_at},${user.last_active},${user.subscribed}`
          ).join("\n");

        fs.writeFileSync(path.join(__dirname, "users.csv"), csvContent);

        await bot.sendDocument(chatId, path.join(__dirname, "users.csv"), {
          caption: "📊 Users list",
          reply_markup: {
            inline_keyboard: [
              [{ text: translations[userLanguage].back, callback_data: "back_to_main" }]
            ]
          }
        });

        fs.unlinkSync(path.join(__dirname, "users.csv"));
      } catch (error) {
        console.error("Error:", error);
        await bot.sendMessage(
          chatId, 
          "❌ Failed to download users.",
          getMainMenu(userLanguage)
        );
      }
      updateUserActivity(user.id, "Tried to download users");
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === "back_to_main") {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].mainMenu, 
        getMainMenu(userLanguage)
      );
      updateUserActivity(user.id, "Returned to main menu");
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === "addbook_manual") {
      waitingForBook[chatId] = { 
        step: "waiting_for_book_name",
        mode: "manual"
      };
      
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].enterBookName,
        getBackMenu(userLanguage)
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    if (data === "addbook_auto") {
      waitingForBook[chatId] = { 
        step: "waiting_for_author_name",
        mode: "auto",
        files: []
      };
      
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].enterAuthor,
        getBackMenu(userLanguage)
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }
  } catch (error) {
    console.error("Callback query error:", error);
    try {
      await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
    } catch (e) {
      console.error("Callback answer error:", e);
    }
  }
});

// /help komandasi
bot.onText(/\/help/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = users.find(u => u.id === msg.from.id) || {};
    const userLanguage = user.language || 'uz';
    
    const helpText = `📚 *Books Bot Help Menu*\n\n` +
      `/start - Start the bot\n` +
      `/help - Help menu\n` +
      `/contact - Contact admins\n` +
      `${translations[userLanguage].searchBook} - Search for a book\n` +
      `${translations[userLanguage].allBooks} - Books by genre\n` +
      `${translations[userLanguage].settings} - Language settings\n\n` +
      `👨‍💻 Admin commands:\n` +
      `/addbook - Add new book\n` +
      `/addreklama - Send advertisement\n` +
      `/users - Users list\n` +
      `/stats - Bot statistics`;
    
    await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
    updateUserActivity(msg.from.id, "Viewed help menu");
  } catch (error) {
    console.error("/help command error:", error);
  }
});

// /contact komandasi
bot.onText(/\/contact/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = users.find(u => u.id === msg.from.id) || {};
    const userLanguage = user.language || 'uz';

    sendMonitoringInfo("Viewed contact info", msg.from);
    await bot.sendMessage(chatId, translations[userLanguage].contactInfo, getMainMenu(userLanguage));
    updateUserActivity(msg.from.id, "Contact info");
  } catch (error) {
    console.error("/contact command error:", error);
  }
});

// /stats komandasi (admin uchun)
bot.onText(/\/stats/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';
    
    if (!ADMIN_IDS.includes(msg.from.id.toString())) {
      await bot.sendMessage(chatId, translations[userLanguage].noPermission, getMainMenu(userLanguage));
      return;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const newUsersToday = users.filter(u => new Date(u.joined_at) >= today).length;
    const activeUsersToday = users.filter(u => new Date(u.last_active) >= today).length;
    const subscribedUsers = users.filter(u => u.subscribed).length;
    
    const statsText = `📊 *Bot Statistics*\n\n` +
      `👥 Total users: ${users.length}\n` +
      `✅ Subscribed: ${subscribedUsers}\n` +
      `🆕 New today: ${newUsersToday}\n` +
      `🔄 Active today: ${activeUsersToday}\n` +
      `📚 Books: ${books.length}\n` +
      `📢 Ads: ${ads.length}\n` +
      `⏰ Server time: ${now.toLocaleString()}`;
    
    await bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
    updateUserActivity(msg.from.id, "Viewed statistics");
  } catch (error) {
    console.error("/stats command error:", error);
  }
});

// /addbook komandasi (admin uchun)
bot.onText(/\/addbook/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    if (!ADMIN_IDS.includes(msg.from.id.toString())) {
      await bot.sendMessage(chatId, translations[userLanguage].noPermission, getMainMenu(userLanguage));
      return;
    }

    sendMonitoringInfo("Entered add book section", user);

    await bot.sendMessage(chatId, translations[userLanguage].addMethod, {
      reply_markup: {
        inline_keyboard: [
          [{ text: translations[userLanguage].manualEntry, callback_data: "addbook_manual" }],
          [{ text: translations[userLanguage].autoEntry, callback_data: "addbook_auto" }],
          [{ text: translations[userLanguage].back, callback_data: "back_to_main" }]
        ]
      }
    });
    updateUserActivity(msg.from.id, "Started adding book");
  } catch (error) {
    console.error("/addbook command error:", error);
  }
});

// /addreklama komandasi (admin uchun)
bot.onText(/\/addreklama/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    if (!ADMIN_IDS.includes(msg.from.id.toString())) {
      await bot.sendMessage(chatId, translations[userLanguage].noPermission, getMainMenu(userLanguage));
      return;
    }

    sendMonitoringInfo("Entered add ad section", user);

    waitingForAd[chatId] = { step: "waiting_for_ad_content" };
    await bot.sendMessage(
      chatId, 
      "📢 Send ad content (text, photo, video or document):",
      getBackMenu(userLanguage)
    );
    updateUserActivity(msg.from.id, "Started adding ad");
  } catch (error) {
    console.error("/addreklama command error:", error);
  }
});

// /users komandasi (admin uchun)
bot.onText(/\/users/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    if (!ADMIN_IDS.includes(msg.from.id.toString())) {
      await bot.sendMessage(chatId, translations[userLanguage].noPermission, getMainMenu(userLanguage));
      return;
    }

    sendMonitoringInfo("Viewed users list", user);

    if (users.length === 0) {
      await bot.sendMessage(chatId, "❌ No users found.", getMainMenu(userLanguage));
      return;
    }

    let message = `👥 Total users: ${users.length}\n✅ Subscribed: ${users.filter(u => u.subscribed).length}\n\n`;

    const recentUsers = users.slice(-10).reverse();

    recentUsers.forEach((user, index) => {
      message += `${index + 1}. ${user.first_name} ${user.last_name || ''} (@${user.username || 'N/A'})\n`;
      message += `🆔: ${user.id}\n`;
      message += `📅 Joined: ${new Date(user.joined_at).toLocaleString()}\n`;
      message += `✅ Subscribed: ${user.subscribed ? 'Yes' : 'No'}\n\n`;
    });

    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📥 Download users", callback_data: "download_users" }],
          [{ text: "🔙 Back", callback_data: "back_to_main" }]
        ]
      }
    });
    updateUserActivity(msg.from.id, "Viewed users list");
  } catch (error) {
    console.error("/users command error:", error);
  }
});

// Xabarlarni qayta ishlash
bot.on("message", async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const user = msg.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    if (!text) return;

    // A'zolikni tekshirish (adminlar uchun emas)
    if (!ADMIN_IDS.includes(user.id.toString())) {
      const isSubscribed = await checkSubscriptions(user.id);
      if (!isSubscribed) {
        let message = translations[userLanguage].notSubscribed + "\n\n";
        REQUIRED_CHANNELS.forEach(channel => {
          message += `- ${channel.link}\n`;
        });
        
        await bot.sendMessage(
          chatId, 
          message,
          getSubscriptionMenu(userLanguage)
        );
        return;
      }
    }

    // Monitoring harakatlari
    if (text === translations[userLanguage].searchBook) {
      sendMonitoringInfo("Entered book search", user);
    } else if (text === translations[userLanguage].allBooks) {
      sendMonitoringInfo("Entered all books section", user);
    } else if (text === translations[userLanguage].settings) {
      sendMonitoringInfo("Entered settings", user);
    } else if (text && !text.startsWith('/')) {
      sendMonitoringInfo("Book search request", user, { query: text });
    }

    // Orqaga tugmasi
    if (text === translations[userLanguage].back) {
      await bot.sendMessage(chatId, translations[userLanguage].back, getMainMenu(userLanguage));
      updateUserActivity(msg.from.id, "Went back");
      return;
    }

    // Asosiy menyu tugmasi
    if (text === translations[userLanguage].mainMenu) {
      await bot.sendMessage(chatId, translations[userLanguage].mainMenu, getMainMenu(userLanguage));
      updateUserActivity(msg.from.id, "Returned to main menu");
      return;
    }

    // Kitob qidirish
    if (text === translations[userLanguage].searchBook) {
      await bot.sendMessage(chatId, "📚 Search by book name, author or genre.", getBackMenu(userLanguage));
      updateUserActivity(msg.from.id, "Started book search");
      return;
    }

    // Barcha kitoblar
    if (text === translations[userLanguage].allBooks) {
      await bot.sendMessage(chatId, "Choose genre:", getGenreMenu(userLanguage));
      updateUserActivity(msg.from.id, "Viewed all books");
      return;
    }

    // Sozlamalar
    if (text === translations[userLanguage].settings) {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].chooseLanguage, 
        languageMenu
      );
      updateUserActivity(msg.from.id, "Opened settings");
      return;
    }

    // Reklama jarayoni
    if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
      if (text) {
        waitingForAd[chatId].text = text;
        waitingForAd[chatId].step = "waiting_for_ad_confirmation";

        const previewText = "📢 Ad preview:\n\n" + waitingForAd[chatId].text;

        if (waitingForAd[chatId].file_id) {
          const options = { 
            caption: previewText,
            parse_mode: "Markdown"
          };

          if (waitingForAd[chatId].file_type === "photo") {
            await bot.sendPhoto(chatId, waitingForAd[chatId].file_id, options);
          } else if (waitingForAd[chatId].file_type === "video") {
            await bot.sendVideo(chatId, waitingForAd[chatId].file_id, options);
          } else if (waitingForAd[chatId].file_type === "document") {
            await bot.sendDocument(chatId, waitingForAd[chatId].file_id, options);
          }
        } else {
          await bot.sendMessage(chatId, previewText, { parse_mode: "Markdown" });
        }

        await bot.sendMessage(
          chatId, 
          "✅ Confirm sending this ad?",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ Confirm", callback_data: "confirm_ad" }],
                [{ text: "❌ Cancel", callback_data: "cancel_ad" }],
                [{ text: translations[userLanguage].back, callback_data: "back_to_main" }],
              ],
            },
          }
        );
        updateUserActivity(msg.from.id, "Entered ad text");
      }
      return;
    }

    // "Tayyor" tugmasi (avtomatik kitob qo'shish)
    if (waitingForBook[chatId] && waitingForBook[chatId].mode === "auto" && text === "✅ Done") {
      if (waitingForBook[chatId].files.length === 0) {
        await bot.sendMessage(chatId, translations[userLanguage].noFiles, getMainMenu(userLanguage));
        delete waitingForBook[chatId];
        return;
      }
      
      waitingForBook[chatId].step = "waiting_for_book_genre";
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].chooseGenre,
        getGenreMenu(userLanguage, "book_genre_")
      );
      return;
    }

    // Kitob qo'shish jarayoni - qo'lda kiritish
    if (waitingForBook[chatId] && waitingForBook[chatId].mode === "manual") {
      if (waitingForBook[chatId].step === "waiting_for_book_name") {
        waitingForBook[chatId].name = text;
        waitingForBook[chatId].step = "waiting_for_book_author";
        
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].enterAuthor,
          getBackMenu(userLanguage)
        );
        return;
      }
      
      if (waitingForBook[chatId].step === "waiting_for_book_author") {
        waitingForBook[chatId].author = text;
        waitingForBook[chatId].step = "waiting_for_book_genre";
        
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].chooseGenre,
          getGenreMenu(userLanguage, "book_genre_")
        );
        return;
      }
    }

    // Kitob qo'shish jarayoni - avtomatik
    if (waitingForBook[chatId] && waitingForBook[chatId].mode === "auto") {
      if (waitingForBook[chatId].step === "waiting_for_author_name") {
        waitingForBook[chatId].author = text;
        waitingForBook[chatId].step = "waiting_for_book_cover";
        
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].sendCover,
          getBackMenu(userLanguage)
        );
        return;
      }
    }

    // Kitob qidirish funksiyasi
    if (text !== "/start") {
      await searchBooks(chatId, text, userLanguage);
      updateUserActivity(msg.from.id, `Searched for "${text}"`);
    }
  } catch (error) {
    console.error("Message handler error:", error);
  }
});

// Fayllarni qayta ishlash
bot.on("document", (msg) => processFile(msg, "document"));
bot.on("photo", (msg) => processFile(msg, "photo"));
bot.on("video", (msg) => processFile(msg, "video"));
bot.on("audio", (msg) => processFile(msg, "audio"));
bot.on("voice", (msg) => processFile(msg, "voice"));

async function processFile(msg, type) {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    // A'zolikni tekshirish (adminlar uchun emas)
    if (!ADMIN_IDS.includes(user.id.toString())) {
      const isSubscribed = await checkSubscriptions(user.id);
      if (!isSubscribed) {
        let message = translations[userLanguage].notSubscribed + "\n\n";
        REQUIRED_CHANNELS.forEach(channel => {
          message += `- ${channel.link}\n`;
        });
        
        await bot.sendMessage(
          chatId, 
          message,
          getSubscriptionMenu(userLanguage)
        );
        return;
      }
    }

    // Reklama fayli
    if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
      let file_id = type === "photo" ? msg.photo[msg.photo.length - 1].file_id : msg[type].file_id;
      waitingForAd[chatId].file_id = file_id;
      waitingForAd[chatId].file_type = type;

      await bot.sendMessage(
        chatId, 
        "📝 Enter text for the ad:",
        getBackMenu(userLanguage)
      );
      updateUserActivity(msg.from.id, "Sent ad file");
      return;
    }

    // Kitob fayli
    if (waitingForBook[chatId] && ADMIN_IDS.includes(msg.from.id.toString())) {
      let file_id = type === "photo" ? msg.photo[msg.photo.length - 1].file_id : msg[type].file_id;
      let file_name = msg[type]?.file_name || "Unknown";
      
      // Avtomatik rejim - fayl nomidan olish
      if (waitingForBook[chatId].mode === "auto") {
        if (type === "photo") {
          // Asosiy rasm (muqova uchun)
          if (!waitingForBook[chatId].image_id) {
            waitingForBook[chatId].image_id = file_id;
            await bot.sendMessage(
              chatId, 
              translations[userLanguage].sendFiles,
              {
                reply_markup: {
                  keyboard: [
                    [{ text: "✅ Done" }],
                    [translations[userLanguage].back]
                  ],
                  resize_keyboard: true
                }
              }
            );
            return;
          }
        }
        
        // Faylni ro'yxatga qo'shish
        waitingForBook[chatId].files.push({
          file_id,
          file_name,
          file_type: type
        });
        
        // Ko'proq fayllar yoki tugatish uchun so'rov
        await bot.sendMessage(
          chatId, 
          `${translations[userLanguage].fileReceived} ${file_name}\n\n${translations[userLanguage].moreFiles}`,
          {
            reply_markup: {
              keyboard: [
                [{ text: "✅ Done" }],
                [translations[userLanguage].back]
              ],
              resize_keyboard: true
            }
          }
        );
        return;
      }
      
      // Qo'lda kiritish rejimi
      if (waitingForBook[chatId].mode === "manual") {
        if (type === "photo") {
          waitingForBook[chatId].image_id = file_id;
          await bot.sendMessage(
            chatId, 
            translations[userLanguage].sendFiles,
            getBackMenu(userLanguage)
          );
        } else {
          waitingForBook[chatId].file_id = file_id;
          waitingForBook[chatId].file_type = type;
          
          const newBook = addBook(waitingForBook[chatId]);
          await bot.sendMessage(
            chatId, 
            `✅ Book added!\n\n📖 Name: ${newBook.name}\n👤 Author: ${newBook.author}\n📂 Genre: ${newBook.genre}`,
            getMainMenu(userLanguage)
          );
          delete waitingForBook[chatId];
        }
        return;
      }
    }
  } catch (error) {
    console.error("File processing error:", error);
  }
}

// Monitoring bot /start komandasi
monitoringBot.onText(/\/start/, (msg) => {
  monitoringBot.sendMessage(msg.chat.id, "👮‍♂️ This bot is for monitoring only. It tracks activities in the library bot and notifies admins.");
});

// Server monitoring
const HEARTBEAT_INTERVAL = 300000; // 5 daqiqa

async function sendHeartbeat() {
  const now = new Date().toLocaleString();
  console.log(`❤️ Heartbeat at ${now}`);
  
  try {
    // Yangi foydalanuvchilar (oxirgi 24 soat)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsers = users.filter(user => new Date(user.joined_at) > oneDayAgo);
    
    // Faol foydalanuvchilar (oxirgi 24 soat)
    const activeUsers = users.filter(user => new Date(user.last_active) > oneDayAgo);
    
    // A'zo bo'lgan foydalanuvchilar
    const subscribedUsers = users.filter(user => user.subscribed);
    
    // Foydalanuvchilar ro'yxatini tayyorlash
    let usersList = "👥 Recent users:\n";
    const recentUsers = users.slice(-5).reverse();
    
    recentUsers.forEach((user, index) => {
      usersList += `\n${index + 1}. ${user.first_name} ${user.last_name || ''}\n`;
      usersList += `🆔 ID: ${user.id}\n`;
      usersList += `📅 Joined: ${new Date(user.joined_at).toLocaleString()}\n`;
      usersList += `✅ Subscribed: ${user.subscribed ? 'Yes' : 'No'}\n`;
    });
    
    // Xabar kontenti
    const message = `🟢 Server running: ${now}\n\n` +
      `📊 Statistics:\n` +
      `- Users: ${users.length}\n` +
      `- Subscribed: ${subscribedUsers.length}\n` +
      `- New users (24h): ${newUsers.length}\n` +
      `- Active users (24h): ${activeUsers.length}\n` +
      `- Books: ${books.length}\n` +
      `- Ads: ${ads.length}\n\n` +
      `${usersList}`;
    
    await monitoringBot.sendMessage(
      MONITORING_CHAT_ID, 
      message,
      { 
        disable_notification: true,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    console.error("Heartbeat error:", error);
    await monitoringBot.sendMessage(
      MONITORING_CHAT_ID,
      `⚠️ Heartbeat error: ${error.message}`,
      { disable_notification: true }
    );
  }
}

// Ma'lumotlarni zaxiralash
function backupData() {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    fs.copyFileSync(
      path.join(__dirname, 'users.json'),
      path.join(backupDir, `users_${timestamp}.json`)
    );
    
    fs.copyFileSync(
      path.join(__dirname, 'books.json'),
      path.join(backupDir, `books_${timestamp}.json`)
    );
    
    fs.copyFileSync(
      path.join(__dirname, 'ads.json'),
      path.join(backupDir, `ads_${timestamp}.json`)
    );
    
    console.log(`✅ Data backed up: ${timestamp}`);
  } catch (error) {
    console.error('⛔ Backup error:', error);
    monitoringBot.sendMessage(
      MONITORING_CHAT_ID,
      `⛔ *Backup error!*\n\n` +
      `📌 Error: ${error.message}`,
      { parse_mode: "Markdown" }
    );
  }
}

// Heartbeat jo'natish har 5 daqiqada
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

// Ma'lumotlarni zaxiralash har soatda
setInterval(backupData, 3600000);

console.log("✅ Library bot started...");
console.log("✅ Monitoring bot started...");