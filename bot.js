require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// Fayllarni yuklash
const books = require("./books.json");
const ads = require("./ads.json");

// Konfiguratsiya
const TOKEN = process.env.BOT_TOKEN || "";
const MONITORING_TOKEN = process.env.MONITORING_BOT_TOKEN || "";
const ADMIN_IDS = process.env.ADMIN_ID ? process.env.ADMIN_ID.split(",").map((id) => id.trim()) : [];
const MONITORING_CHAT_ID = process.env.MONITORING_CHAT_ID || "";
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
    // 👋 Salomlashuv va asosiy menyu
    welcome: "👋 Assalomu alaykum! 📚 Kitoblar dunyosiga xush kelibsiz!\n\n🛎 Botimiz orqali siz:\n🔍 Kitob qidirishingiz\n📥 Yuklab olishingiz\n📚 Kutubxonangizni boshqarishingiz mumkin\n\n👇 Quyidagi menyulardan foydalaning:",
    mainMenu: "🏠 Bosh menyu",
    back: "🔙 Orqaga qaytish",
    
    // 🔍 Qidiruv bo'limi
    searchBook: "🔍 Kitob qidirish",
    bookNotFound: "❌ Kitob topilmadi!\n\n❗️ Sabablari:\n1️⃣ Noto'g'ri nom kiritilgan (masalan: \"Otkan kunlar\" o'rniga \"O'tkan kunlar\")\n2️⃣ Botda bu kitob mavjud emas\n3️⃣ Lotin yoki Kirill alifbosida xato\n\n💡 Qayta urinib ko'ring yoki admin @Sadikov001 ga murojaat qiling",
    allBooks: "📚 Barcha kitoblar",
    
    // ⚙️ Sozlamalar
    settings: "⚙️ Sozlamalar",
    changeLanguage: "🌐 Tilni o'zgartirish",
    languageChanged: "✅ Til muvaffaqiyatli o'zgardi!",
    chooseLanguage: "🗣 Tilni tanlang:",
    languageSelected: "✅ Til tanlandi!",
    
    // 🔐 Admin funktsiyalari
    noPermission: "⛔️ Sizda ruxsat yo'q!",
    bookAdded: "✅ Kitob qo'shildi! 📖",
    booksAdded: "✅ {count} ta kitob qo'shildi!\n✍️ Muallif: {author}\n🏷 Janr: {genre}",
    adSent: "📢 Reklama yuborildi! ✅",
    adCanceled: "❌ Reklama bekor qilindi.",
    
    // 📥 Kitob qo'shish
    addMethod: "📥 Kitob qo'shish usuli:",
    manualEntry: "✍️ Qo'lda kiritish",
    autoEntry: "📂 Fayldan olish",
    enterBookName: "📖 Kitob nomini kiriting:\n\n📌 Misol: \"O'tkan kunlar\"",
    enterAuthor: "✍️ Muallifni kiriting:\n\n📌 Misol: \"Abdulla Qodiriy\"",
    sendCover: "🖼 Kitob muqovasini yuboring:\n\n📸 Format: JPG/PNG\n⚖️ Hajm: 2MB gacha",
    sendFiles: "📄 Kitob fayllarini yuboring:\n\n📂 Qabul qilinadigan formatlar:\n✅ PDF\n✅ EPUB\n✅ DOCX\n\n⚖️ Maksimal hajm: 50MB",
    fileReceived: "📥 Fayl qabul qilindi: {filename}",
    moreFiles: "🔄 Yana fayl yuborishingiz mumkin yoki \"✅ Tayyor\" tugmasini bosing",
    chooseGenre: "📂 Janrni tanlang:",
    noFiles: "❌ Fayl yuborilmadi!",
    
    // 📞 Bog'lanish
    contactInfo: "📞 Bog'lanish uchun:\n\n📱 Telefon: +998974634455\n✉️ Telegram: @Sadikov001\n\n⏰ Ish vaqti: 09:00-18:00",
    
    // 📢 Obuna bo'lish
    notSubscribed: "⚠️ Botdan foydalanish uchun kanal(lar)ga obuna bo'ling:",
    checkSubscription: "✅ Obunani tekshirish",
    subscribed: "🎉 Obuna bo'ldingiz! Endi botdan to'liq foydalanishingiz mumkin.",
    stillNotSubscribed: "❌ Siz hali obuna bo'lmagansiz. Iltimos, kanal(lar)ga obuna bo'ling va \"✅ Obunani tekshirish\" tugmasini bosing.",
    
    // 📌 Metadata
    author: "✍️ Muallif",
    genre: "🏷 Janr"
  },
  ru: {
    // 👋 Приветствие и главное меню
    welcome: "👋 Добро пожаловать в мир книг! 📚\n\n🛎 С нашим ботом вы можете:\n🔍 Искать книги\n📥 Скачивать\n📚 Управлять своей библиотекой\n\n👇 Используйте меню ниже:",
    mainMenu: "🏠 Главное меню",
    back: "🔙 Назад",
    
    // 🔍 Поиск
    searchBook: "🔍 Поиск книги",
    bookNotFound: "❌ Книга не найдена!\n\n❗️ Возможные причины:\n1️⃣ Ошибка в названии\n2️⃣ Книга отсутствует в базе\n3️⃣ Неправильная раскладка\n\n💡 Попробуйте еще раз или свяжитесь с админом @Sadikov001",
    allBooks: "📚 Все книги",
    
    // ⚙️ Настройки
    settings: "⚙️ Настройки",
    changeLanguage: "🌐 Сменить язык",
    languageChanged: "✅ Язык изменен!",
    chooseLanguage: "🗣 Выберите язык:",
    languageSelected: "✅ Язык выбран!",
    
    // 🔐 Админ-функции
    noPermission: "⛔️ Нет доступа!",
    bookAdded: "✅ Книга добавлена! 📖",
    booksAdded: "✅ Добавлено {count} книг!\n✍️ Автор: {author}\n🏷 Жанр: {genre}",
    adSent: "📢 Реклама отправлена! ✅",
    adCanceled: "❌ Реклама отменена.",
    
    // 📥 Добавление книг
    addMethod: "📥 Способ добавления:",
    manualEntry: "✍️ Вручную",
    autoEntry: "📂 Из файла",
    enterBookName: "📖 Введите название:\n\n📌 Пример: \"Преступление и наказание\"",
    enterAuthor: "✍️ Введите автора:\n\n📌 Пример: \"Фёдор Достоевский\"",
    sendCover: "🖼 Отправьте обложку:\n\n📸 Формат: JPG/PNG\n⚖️ Размер: до 2MB",
    sendFiles: "📄 Отправьте файлы книги:\n\n📂 Форматы:\n✅ PDF\n✅ EPUB\n✅ DOCX\n\n⚖️ Макс. размер: 50MB",
    fileReceived: "📥 Файл получен: {filename}",
    moreFiles: "🔄 Можно отправить еще или нажать \"✅ Готово\"",
    chooseGenre: "📂 Выберите жанр:",
    noFiles: "❌ Файлы не отправлены!",
    
    // 📞 Контакты
    contactInfo: "📞 Контакты:\n\n📱 Телефон: +998974634455\n✉️ Telegram: @Sadikov001\n\n⏰ Часы работы: 09:00-18:00",
    
    // 📢 Подписка
    notSubscribed: "⚠️ Для использования бота подпишитесь на канал(ы):",
    checkSubscription: "✅ Проверить подписку",
    subscribed: "🎉 Вы подписаны! Теперь можно пользоваться ботом.",
    stillNotSubscribed: "❌ Вы еще не подписаны. Подпишитесь и нажмите \"✅ Проверить подписку\".",
    
    // 📌 Метаданные
    author: "✍️ Автор",
    genre: "🏷 Жанр"
  },
  en: {
    // 👋 Greetings and main menu
    welcome: "👋 Welcome to Books World! 📚\n\n🛎 With our bot you can:\n🔍 Search books\n📥 Download\n📚 Manage your library\n\n👇 Use the menu below:",
    mainMenu: "🏠 Main Menu",
    back: "🔙 Back",
    
    // 🔍 Search
    searchBook: "🔍 Search Book",
    bookNotFound: "❌ Book not found!\n\n❗️ Possible reasons:\n1️⃣ Wrong title\n2️⃣ Book not in database\n3️⃣ Input error\n\n💡 Try again or contact admin @Sadikov001",
    allBooks: "📚 All Books",
    
    // ⚙️ Settings
    settings: "⚙️ Settings",
    changeLanguage: "🌐 Change Language",
    languageChanged: "✅ Language changed!",
    chooseLanguage: "🗣 Choose language:",
    languageSelected: "✅ Language selected!",
    
    // 🔐 Admin functions
    noPermission: "⛔️ No permission!",
    bookAdded: "✅ Book added! 📖",
    booksAdded: "✅ Added {count} books!\n✍️ Author: {author}\n🏷 Genre: {genre}",
    adSent: "📢 Ad sent! ✅",
    adCanceled: "❌ Ad canceled.",
    
    // 📥 Add books
    addMethod: "📥 Adding method:",
    manualEntry: "✍️ Manual",
    autoEntry: "📂 From file",
    enterBookName: "📖 Enter title:\n\n📌 Example: \"The Great Gatsby\"",
    enterAuthor: "✍️ Enter author:\n\n📌 Example: \"F. Scott Fitzgerald\"",
    sendCover: "🖼 Send cover:\n\n📸 Format: JPG/PNG\n⚖️ Size: up to 2MB",
    sendFiles: "📄 Send book files:\n\n📂 Formats:\n✅ PDF\n✅ EPUB\n✅ DOCX\n\n⚖️ Max size: 50MB",
    fileReceived: "📥 File received: {filename}",
    moreFiles: "🔄 You can send more or press \"✅ Done\"",
    chooseGenre: "📂 Choose genre:",
    noFiles: "❌ No files sent!",
    
    // 📞 Contacts
    contactInfo: "📞 Contacts:\n\n📱 Phone: +998974634455\n✉️ Telegram: @Sadikov001\n\n⏰ Working hours: 09:00-18:00",
    
    // 📢 Subscription
    notSubscribed: "⚠️ To use bot, subscribe to channel(s):",
    checkSubscription: "✅ Check Subscription",
    subscribed: "🎉 Subscribed! Now you can use the bot.",
    stillNotSubscribed: "❌ Still not subscribed. Please subscribe and press \"✅ Check Subscription\".",
    
    // 📌 Metadata
    author: "✍️ Author",
    genre: "🏷 Genre"
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
    
    let message = `👤 *Foydalanuvchi:* ${user.first_name} ${user.last_name || ''} (@${user.username || 'Mavjud emas'})\n`;
    message += `🆔 *ID:* ${user.id}\n`;
    message += `📅 *Qo'shilgan sana:* ${new Date(userObj.joined_at || now).toLocaleDateString()}\n`;
    message += `⏰ *Oxirgi faollik:* ${now.toLocaleString()}\n`;
    message += `✅ *A'zolik:* ${userObj.subscribed ? 'Ha' : 'Yo\'q'}\n\n`;
    message += `📌 *Harakat:* ${action}\n`;

    if (Object.keys(additionalData).length > 0) {
      message += `\n📊 *Tafsilotlar:* \`\`\`${JSON.stringify(additionalData, null, 2)}\`\`\`\n`;
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
// Kitob qidirish funksiyasi (optimallashtirilgan versiya)
async function searchBooks(chatId, query, userLanguage = 'uz', isGenreSearch = false) {
  try {
    // Bo'sh so'rovni tekshirish
    if (!query || query.trim() === "") {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].bookNotFound,
        getBackMenu(userLanguage)
      );
      return;
    }

    // Kitoblarni qidirish
    const searchQuery = query.toLowerCase().trim();
    let results = books.filter(book => {
      if (isGenreSearch) {
        return book.genre?.toLowerCase().includes(searchQuery);
      } else {
        return (
          book.name?.toLowerCase().includes(searchQuery) ||
          book.author?.toLowerCase().includes(searchQuery)
        );
      }
    });

    if (results.length === 0) {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].bookNotFound,
        getBackMenu(userLanguage)
      );
      return;
    }

    // Agar janr bo'yicha qidirilayotgan bo'lsa
    if (isGenreSearch) {
      await sendBooksByGenre(chatId, results, query, userLanguage);
      return;
    }

    // Agar oddiy qidiruv bo'lsa
    if (results.length <= 5) {
      // 5 tadan kam bo'lsa hammasini yuborish
      for (const book of results) {
        await sendBookFile(chatId, book, userLanguage);
        await delay(500); // Flooddan qochish uchun
      }
    } else {
      // 5 tadan ko'p bo'lsa birinchi 5 tasini yuborish
      const firstFive = results.slice(0, 5);
      for (const book of firstFive) {
        await sendBookFile(chatId, book, userLanguage);
        await delay(500);
      }
      
      // Qolganlari uchun "Ko'proq ko'rish" tugmasi
      const remainingCount = results.length - 5;
      await bot.sendMessage(
        chatId,
        `📚 Yana ${remainingCount} ta natija topildi. Ko'proq ko'rish uchun tugmani bosing:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{
                text: `🔍 Ko'proq ko'rish (${remainingCount} ta)`,
                callback_data: `show_more:${searchQuery}:5`
              }],
              [{
                text: translations[userLanguage].back,
                callback_data: "back_to_main"
              }]
            ]
          }
        }
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

// Janr bo'yicha kitoblarni yuborish
async function sendBooksByGenre(chatId, results, genre, userLanguage) {
  // 6 tadan kam bo'lsa hammasini yuborish
  if (results.length <= 6) {
    for (const book of results) {
      await sendBookFile(chatId, book, userLanguage);
      await delay(500);
    }
    return;
  }

  // 6 tadan ko'p bo'lsa birinchi 6 tasini yuborish
  const firstSix = results.slice(0, 6);
  for (const book of firstSix) {
    await sendBookFile(chatId, book, userLanguage);
    await delay(500);
  }

  // Qolganlari uchun "Ko'proq ko'rish" tugmasi
  const remainingCount = results.length - 6;
  await bot.sendMessage(
    chatId,
    `📚 "${genre}" janridan yana ${remainingCount} ta kitob topildi. Ko'proq ko'rish uchun tugmani bosing:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: `🔍 Ko'proq ko'rish (${remainingCount} ta)`,
            callback_data: `show_more_genre:${genre}:6`
          }],
          [{
            text: translations[userLanguage].back,
            callback_data: "back_to_main"
          }]
        ]
      }
    }
  );
}

// Kitob faylini yuborish (optimallashtirilgan)
async function sendBookFile(chatId, book, userLanguage) {
  if (!book.file_id) {
    await bot.sendMessage(
      chatId, 
      `⚠️ ${formatBookName(book.name)} mavjud, lekin fayli yo'q.`, 
      { 
        parse_mode: "Markdown",
        reply_markup: getBackMenu(userLanguage).reply_markup
      }
    );
    return;
  }

  let caption = `📖 *${formatBookName(book.name)}*\n`;
  caption += `👤 *${translations[userLanguage].author}:* ${formatBookName(book.author || "Noma'lum")}\n`;
  caption += `📂 *${translations[userLanguage].genre}:* ${book.genre}\n\n`;
  caption += `${REQUIRED_CHANNELS[0].link}`;

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
    default:
      await bot.sendDocument(chatId, book.file_id, options);
  }
}

// Qo'shimcha natijalarni ko'rsatish
async function showMoreResults(chatId, query, offset, userLanguage, isGenre = false) {
  let results;
  
  if (isGenre) {
    results = books.filter(book => 
      book.genre?.toLowerCase().includes(query.toLowerCase())
    );
  } else {
    results = books.filter(book => 
      book.name?.toLowerCase().includes(query.toLowerCase()) || 
      book.author?.toLowerCase().includes(query.toLowerCase())
    );
  }

  if (results.length <= offset) {
    await bot.sendMessage(
      chatId,
      "⚠️ Boshqa natijalar topilmadi",
      getBackMenu(userLanguage)
    );
    return;
  }

  const nextBatch = isGenre 
    ? results.slice(offset, offset + 6)
    : results.slice(offset, offset + 5);

  for (const book of nextBatch) {
    await sendBookFile(chatId, book, userLanguage);
    await delay(500);
  }

  const newOffset = isGenre ? offset + 6 : offset + 5;
  const remainingCount = results.length - newOffset;

  if (remainingCount > 0) {
    const buttonText = isGenre 
      ? `🔍 Ko'proq ko'rish (${remainingCount} ta)`
      : `🔍 Ko'proq ko'rish (${remainingCount} ta)`;

    const callbackData = isGenre
      ? `show_more_genre:${query}:${newOffset}`
      : `show_more:${query}:${newOffset}`;

    await bot.sendMessage(
      chatId,
      isGenre
        ? `📚 "${query}" janridan yana ${remainingCount} ta kitob topildi.`
        : `📚 "${query}" bo'yicha yana ${remainingCount} ta natija topildi.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: buttonText, callback_data: callbackData }],
            [{ text: translations[userLanguage].back, callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

// Callback query handler (yangi versiya)
bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const user = query.from;
    const userObj = users.find(u => u.id === user.id) || {};
    const userLanguage = userObj.language || 'uz';

    if (query.data.startsWith("show_more:")) {
      const parts = query.data.split(":");
      const searchQuery = parts[1];
      const offset = parseInt(parts[2]);
      await showMoreResults(chatId, searchQuery, offset, userLanguage);
      await bot.answerCallbackQuery(query.id);
    }
    else if (query.data.startsWith("show_more_genre:")) {
      const parts = query.data.split(":");
      const genre = parts[1];
      const offset = parseInt(parts[2]);
      await showMoreResults(chatId, genre, offset, userLanguage, true);
      await bot.answerCallbackQuery(query.id);
    }
  } catch (error) {
    console.error("Callback query error:", error);
    await bot.answerCallbackQuery(query.id, {
      text: "Xatolik yuz berdi!"
    });
  }
});

// Qisqa kutish funksiyasi
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Kitob tafsilotlarini yuborish
async function sendBookDetails(chatId, book, userLanguage) {
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
      default:
        await bot.sendDocument(chatId, book.file_id, options);
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

// Callback query handlerga qo'shimcha (barcha natijalarni ko'rsatish)
bot.on("callback_query", async (query) => {
  try {
    // ... avvalgi kodlar ...
    
    if (query.data.startsWith("show_all_results:")) {
      const searchQuery = query.data.split(":")[1];
      const chatId = query.message.chat.id;
      const user = query.from;
      const userObj = users.find(u => u.id === user.id) || {};
      const userLanguage = userObj.language || 'uz';
      
      // Qidiruvni qayta bajarish
      const results = books.filter(book => {
        const bookName = book.name?.toLowerCase() || '';
        const author = book.author?.toLowerCase() || '';
        const genre = book.genre?.toLowerCase() || '';

        return (
          bookName.includes(searchQuery) ||
          author.includes(searchQuery) ||
          genre.includes(searchQuery)
        );
      });

      // Har bir kitob uchun alohida xabar yuborish
      for (const book of results) {
        await sendBookDetails(chatId, book, userLanguage);
      }
      
      await bot.answerCallbackQuery(query.id);
    }
    
    // ... avvalgi kodlar ...
  } catch (error) {
    console.error("Callback query error:", error);
  }
});

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
      sendMonitoringInfo("Kitob qidirish bo'limiga kirdi", user);
    } else if (text === translations[userLanguage].allBooks) {
      sendMonitoringInfo("Barcha kitoblar bo'limiga kirdi", user);
    } else if (text === translations[userLanguage].settings) {
      sendMonitoringInfo("Sozlamalar bo'limiga kirdi", user);
    } else if (text && !text.startsWith('/')) {
      sendMonitoringInfo("Kitob qidirish so'rovi", user, { sorov: text });
    }

    // Orqaga tugmasi
    if (text === translations[userLanguage].back) {
      await bot.sendMessage(chatId, translations[userLanguage].back, getMainMenu(userLanguage));
      updateUserActivity(msg.from.id, "Orqaga qaytdi");
      return;
    }

    // Asosiy menyu tugmasi
    if (text === translations[userLanguage].mainMenu) {
      await bot.sendMessage(chatId, translations[userLanguage].mainMenu, getMainMenu(userLanguage));
      updateUserActivity(msg.from.id, "Asosiy menyuga qaytdi");
      return;
    }

    // Kitob qidirish
    if (text === translations[userLanguage].searchBook) {
      await bot.sendMessage(
        chatId, 
        "🔍 Kitob nomi, muallifi yoki janri bo'yicha qidiring. 📚 Misol uchun: 'Oʻtkan kunlar' yoki 'Abdulla Qodiriy'. ✨ Agar topa olmasangiz, iltimos, adminga xabar bering. 📝 /contact deb yozsangiz, admin bilan bog'lanasiz. 📲",
        getBackMenu(userLanguage)
      );
      updateUserActivity(msg.from.id, "Kitob qidirishni boshladi");
      return;
    }

    // Barcha kitoblar
    if (text === translations[userLanguage].allBooks) {
      await bot.sendMessage(
        chatId, 
        "Janrni tanlang:", 
        getGenreMenu(userLanguage)
      );
      updateUserActivity(msg.from.id, "Barcha kitoblarni ko'rdi");
      return;
    }

    // Sozlamalar
    if (text === translations[userLanguage].settings) {
      await bot.sendMessage(
        chatId, 
        translations[userLanguage].chooseLanguage, 
        languageMenu
      );
      updateUserActivity(msg.from.id, "Sozlamalarni ochdi");
      return;
    }

    // Reklama jarayoni
    if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
      if (text) {
        waitingForAd[chatId].text = text;
        waitingForAd[chatId].step = "waiting_for_ad_confirmation";

        const previewText = "📢 Reklama oldindan ko'rinishi:\n\n" + waitingForAd[chatId].text;

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
          "✅ Ushbu reklamani yuborishni tasdiqlaysizmi?",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ Tasdiqlash", callback_data: "confirm_ad" }],
                [{ text: "❌ Bekor qilish", callback_data: "cancel_ad" }],
                [{ text: translations[userLanguage].back, callback_data: "back_to_main" }],
              ],
            },
          }
        );
        updateUserActivity(msg.from.id, "Reklama matnini kiritdi");
      }
      return;
    }

    // "Tayyor" tugmasi (avtomatik kitob qo'shish)
    if (waitingForBook[chatId] && waitingForBook[chatId].mode === "auto" && text === "✅ Tayyor") {
      if (waitingForBook[chatId].files.length === 0) {
        await bot.sendMessage(
          chatId, 
          translations[userLanguage].noFiles, 
          getMainMenu(userLanguage)
        );
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
      updateUserActivity(msg.from.id, `"${text}" so'zi bo'yicha qidirdi`);
    }
  } catch (error) {
    console.error("Xabar qayta ishlashda xato:", error);
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


const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 soat
async function sendHeartbeat() {
  const now = new Date().toLocaleString();
  console.log(`❤️ Yurak urishi: ${now}`);

  try {
    // Yangi foydalanuvchilar (oxirgi 24 soat ichida)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsers = users.filter(user => new Date(user.joined_at) > oneDayAgo);

    // Faol foydalanuvchilar (oxirgi 24 soat ichida)
    const activeUsers = users.filter(user => new Date(user.last_active) > oneDayAgo);

    // A'zo bo'lgan foydalanuvchilar
    const subscribedUsers = users.filter(user => user.subscribed);

    // Foydalanuvchilar ro'yxatini tayyorlash
    let usersList = "👥 So'nggi foydalanuvchilar:\n";
    const recentUsers = users.slice(-5).reverse();

    recentUsers.forEach((user, index) => {
      usersList += `\n${index + 1}. ${user.first_name} ${user.last_name || ''}\n`;
      usersList += `🆔 ID: ${user.id}\n`;
      usersList += `📅 Qoʻshilgan: ${new Date(user.joined_at).toLocaleString()}\n`;
      usersList += `✅ Aʼzo: ${user.subscribed ? 'Ha' : 'Yoʻq'}\n`;
    });

    // Xabar matni
    const message = `🟢 Server ishlayapti: ${now}\n\n` +
      `📊 Statistika:\n` +
      `- Foydalanuvchilar: ${users.length}\n` +
      `- Aʼzo boʻlganlar: ${subscribedUsers.length}\n` +
      `- Yangi foydalanuvchilar (24 soat): ${newUsers.length}\n` +
      `- Faol foydalanuvchilar (24 soat): ${activeUsers.length}\n` +
      `- Kitoblar soni: ${books.length}\n` +
      `- Reklamalar soni: ${ads.length}\n\n` +
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
    console.error("Yurak urishi xatosi:", error);
    await monitoringBot.sendMessage(
      MONITORING_CHAT_ID,
      `⚠️ Yurak urishi xatosi: ${error.message}`,
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




