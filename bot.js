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
const CHANNEL_LINK = "https://t.me/KinolarTarjimaFantastikYangiKino";

// Botlarni yaratish
const bot = new TelegramBot(TOKEN, { polling: true });
const monitoringBot = new TelegramBot(MONITORING_TOKEN, { polling: true });

// Foydalanuvchilar faylini yaratish (agar mavjud bo'lmasa)
if (!fs.existsSync(path.join(__dirname, "users.json"))) {
  fs.writeFileSync(path.join(__dirname, "users.json"), JSON.stringify([], null, 2));
}

// Ma'lumotlar
let users = require("./users.json");
const monitoringMessages = new Map(); // Monitoring xabarlarini saqlash

// Vaqtinchalik ma'lumotlar
const waitingForBook = {};
const waitingForAd = {};

// Til matnlari
const translations = {
  uz: {
    welcome: "Assalomu alaykum! Botimizga xush kelibsiz. Iltimos, tilni tanlang:",
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
    adCanceled: "❌ Reklama bekor qilindi."
  },
  ru: {
    welcome: "Здравствуйте! Добро пожаловать в наш бот. Пожалуйста, выберите язык:",
    languageSelected: "Язык выбран!",
    chooseLanguage: "Выберите язык:",
    noPermission: "❌ У вас нет прав выполнять эту команду.",
    bookNotFound: "❌ Книга не найдена.",
    back: "🔙 Назад",
    mainMenu: "🏠 Главное меню",
    searchBook: "📚 Поиск книги",
    allBooks: "📂 Все книги",
    settings: "⚙️ Настройки",
    contactInfo: "Для связи с администраторами:\n📞 Телефон: +998974634455\n📲 Telegram: @Sadikov001",
    bookAdded: "✅ Книга добавлена!",
    adSent: "✅ Объявление отправлено!",
    adCanceled: "❌ Объявление отменено."
  },
  en: {
    welcome: "Hello! Welcome to our bot. Please choose language:",
    languageSelected: "Language selected!",
    chooseLanguage: "Choose language:",
    noPermission: "❌ You don't have permission.",
    bookNotFound: "❌ Book not found.",
    back: "🔙 Back",
    mainMenu: "🏠 Main menu",
    searchBook: "📚 Search book",
    allBooks: "📂 All books",
    settings: "⚙️ Settings",
    contactInfo: "To contact the admins:\n📞 Phone: +998974634455\n📲 Telegram: @Sadikov001",
    bookAdded: "✅ Book added!",
    adSent: "✅ Ad sent!",
    adCanceled: "❌ Ad canceled."
  }
};

// Til menyusi
const languageMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🇺🇿 O'zbekcha", callback_data: "uz" }],
      [{ text: "🇷🇺 Русский", callback_data: "ru" }],
      [{ text: "🇬🇧 English", callback_data: "en" }],
    ],
  },
};

// Asosiy menyu
function getMainMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [translations[lang].searchBook],
        [translations[lang].allBooks],
        [translations[lang].settings],
      ],
      resize_keyboard: true,
    },
  };
}

// Orqaga menyusi
function getBackMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [translations[lang].back],
        [translations[lang].mainMenu],
      ],
      resize_keyboard: true,
    },
  };
}

// Foydalanuvchilarni saqlash
function saveUsers() {
  fs.writeFileSync(path.join(__dirname, "users.json"), JSON.stringify(users, null, 2));
}

// Kitoblarni saqlash
function saveBooks() {
  fs.writeFileSync(path.join(__dirname, "books.json"), JSON.stringify(books, null, 2));
}

// Reklamalarni saqlash
function saveAds() {
  fs.writeFileSync(path.join(__dirname, "ads.json"), JSON.stringify(ads, null, 2));
}

// Yangi foydalanuvchi qo'shish
function addUser(user) {
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
      actions: []
    });
    saveUsers();
    return true;
  }
  return false;
}

// Foydalanuvchi tilini yangilash
function updateUserLanguage(userId, language) {
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].language = language;
    users[userIndex].last_active = new Date().toISOString();
    saveUsers();
    return true;
  }
  return false;
}

// Foydalanuvchi harakatini yangilash
function updateUserActivity(userId, action) {
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].last_active = new Date().toISOString();
    
    if (action) {
      if (!users[userIndex].actions) {
        users[userIndex].actions = [];
      }
      users[userIndex].actions.push({
        action,
        timestamp: new Date().toISOString()
      });
      
      if (users[userIndex].actions.length > 5) {
        users[userIndex].actions.shift();
      }
    }
    
    saveUsers();
    return true;
  }
  return false;
}

// Yangi kitob qo'shish
function addBook(bookData) {
  const newBook = {
    id: Date.now().toString(),
    name: bookData.name,
    author: bookData.author || "Noma'lum",
    genre: bookData.genre || "Boshqa",
    file_id: bookData.file_id || null,
    file_type: bookData.file_type || null,
    image_id: bookData.image_id || null,
    added_at: new Date().toISOString()
  };

  books.push(newBook);
  saveBooks();
  return newBook;
}

// Reklamalarni yuborish
async function broadcastAd(ad) {
  for (const user of users) {
    try {
      const lang = user.language || 'uz';

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
}

// Monitoring xabarlari
async function sendMonitoringInfo(action, user, additionalData = {}) {
  try {
    const userId = user.id;
    const now = new Date();
    const userObj = users.find(u => u.id === userId) || {};
    
    let message = `👤 *Foydalanuvchi:* ${user.first_name} ${user.last_name || ''} (@${user.username || 'N/A'})\n`;
    message += `🆔 *ID:* ${userId}\n`;
    message += `📅 *Qo'shilgan:* ${new Date(userObj.joined_at || now).toLocaleDateString()}\n`;
    message += `🌐 *Til:* ${userObj.language || 'uz'}\n`;
    message += `⏰ *So'nggi faollik:* ${now.toLocaleString()}\n\n`;
    message += `📌 *Harakat:* ${action}\n`;

    if (Object.keys(additionalData).length > 0) {
      message += `\n📊 *Tafsilotlar:* \`\`\`${JSON.stringify(additionalData, null, 2)}\`\`\`\n`;
    }

    if (userObj.actions?.length > 0) {
      message += `\n🔄 *Oxirgi harakatlar:*`;
      userObj.actions.slice(-3).forEach((act, idx) => {
        message += `\n${idx + 1}. ${act.action} - ${new Date(act.timestamp).toLocaleTimeString()}`;
      });
    }

    if (monitoringMessages.has(userId)) {
      try {
        const msgId = monitoringMessages.get(userId);
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
        monitoringMessages.set(userId, newMsg.message_id);
      }
    } else {
      const newMsg = await monitoringBot.sendMessage(
        MONITORING_CHAT_ID, 
        message, 
        { parse_mode: 'Markdown' }
      );
      monitoringMessages.set(userId, newMsg.message_id);
    }
  } catch (error) {
    console.error("Monitoringda xato:", error);
  }
}

// Server monitoringi uchun
const HEARTBEAT_INTERVAL = 5000; // 5 sekund

function sendHeartbeat() {
  const now = new Date().toLocaleString();
  console.log(`❤️ Heartbeat at ${now}`);
  
  try {
    monitoringBot.sendMessage(
      MONITORING_CHAT_ID, 
      `🟢 Server ishlayapti: ${now}\n📊 Statistikalar:\n- Foydalanuvchilar: ${users.length}\n- Kitoblar: ${books.length}\n- Reklamalar: ${ads.length}`,
      { disable_notification: true }
    );
  } catch (error) {
    console.error("Heartbeat xatosi:", error);
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
    
    console.log(`✅ Ma'lumotlar zaxiralandi: ${timestamp}`);
  } catch (error) {
    console.error('⛔ Zaxiralashda xato:', error);
    monitoringBot.sendMessage(
      MONITORING_CHAT_ID,
      `⛔ *Zaxiralashda xato!*\n\n` +
      `📌 Xato: ${error.message}`,
      { parse_mode: "Markdown" }
    );
  }
}

// /start komandasi
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  const isNewUser = addUser({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  });

  const lang = users.find(u => u.id === user.id)?.language || 'uz';

  if (isNewUser) {
    sendMonitoringInfo("Yangi foydalanuvchi qo'shildi", user);
    bot.sendMessage(chatId, translations[lang].welcome, languageMenu);
  } else {
    sendMonitoringInfo("Botni qayta ishga tushirdi", user);
    bot.sendMessage(chatId, translations[lang].chooseLanguage, languageMenu);
  }
  updateUserActivity(user.id, "Botni ishga tushirdi");
});

// /help komandasi
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';
  
  const helpText = lang === "uz" 
    ? `📚 *Kutubxona Boti Yordam Menyusi*\n\n` +
      `/start - Botni ishga tushirish\n` +
      `/help - Yordam menyusi\n` +
      `/contact - Adminlar bilan bog'lanish\n` +
      `📚 Kitob qidirish - Kitob izlash\n` +
      `📂 Barcha kitoblar - Janr bo'yicha kitoblar\n` +
      `⚙️ Sozlamalar - Til sozlamalari\n\n` +
      `👨‍💻 Admin buyruqlari:\n` +
      `/addbook - Yangi kitob qo'shish\n` +
      `/addreklama - Reklama yuborish\n` +
      `/users - Foydalanuvchilar ro'yxati`
    : lang === "ru" 
    ? `📚 *Помощь по Библиотечному Боту*\n\n` +
      `/start - Запустить бота\n` +
      `/help - Меню помощи\n` +
      `/contact - Связаться с админами\n` +
      `📚 Поиск книги - Найти книгу\n` +
      `📂 Все книги - Книги по жанрам\n` +
      `⚙️ Настройки - Языковые настройки\n\n` +
      `👨‍💻 Команды админа:\n` +
      `/addbook - Добавить книгу\n` +
      `/addreklama - Отправить рекламу\n` +
      `/users - Список пользователей`
    : `📚 *Library Bot Help Menu*\n\n` +
      `/start - Start the bot\n` +
      `/help - Help menu\n` +
      `/contact - Contact admins\n` +
      `📚 Search book - Find a book\n` +
      `📂 All books - Books by genre\n` +
      `⚙️ Settings - Language settings\n\n` +
      `👨‍💻 Admin commands:\n` +
      `/addbook - Add new book\n` +
      `/addreklama - Send advertisement\n` +
      `/users - Users list`;
  
  bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
  updateUserActivity(msg.from.id, "Yordam menyusini ko'rdi");
});

// /contact komandasi
bot.onText(/\/contact/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  sendMonitoringInfo("Kontakt ma'lumotlarini ko'rdi", user);
  bot.sendMessage(chatId, translations[lang].contactInfo, getMainMenu(lang));
  updateUserActivity(msg.from.id, "Kontakt ma'lumotlari");
});

// /stats komandasi (admin uchun)
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';
  
  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, translations[lang].noPermission, getMainMenu(lang));
    return;
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const newUsersToday = users.filter(u => new Date(u.joined_at) >= today).length;
  const activeUsersToday = users.filter(u => new Date(u.last_active) >= today).length;
  
  const statsText = lang === "uz" 
    ? `📊 *Bot statistikasi*\n\n` +
      `👥 Umumiy foydalanuvchilar: ${users.length}\n` +
      `🆕 Bugun qo'shilgan: ${newUsersToday}\n` +
      `🔄 Bugun faol: ${activeUsersToday}\n` +
      `📚 Kitoblar: ${books.length}\n` +
      `📢 Reklamalar: ${ads.length}\n` +
      `⏰ Server vaqti: ${now.toLocaleString()}`
    : lang === "ru" 
    ? `📊 *Статистика бота*\n\n` +
      `👥 Всего пользователей: ${users.length}\n` +
      `🆕 Новые сегодня: ${newUsersToday}\n` +
      `🔄 Активные сегодня: ${activeUsersToday}\n` +
      `📚 Книги: ${books.length}\n` +
      `📢 Рекламы: ${ads.length}\n` +
      `⏰ Время сервера: ${now.toLocaleString()}`
    : `📊 *Bot statistics*\n\n` +
      `👥 Total users: ${users.length}\n` +
      `🆕 New today: ${newUsersToday}\n` +
      `🔄 Active today: ${activeUsersToday}\n` +
      `📚 Books: ${books.length}\n` +
      `📢 Ads: ${ads.length}\n` +
      `⏰ Server time: ${now.toLocaleString()}`;
  
  bot.sendMessage(chatId, statsText, { parse_mode: "Markdown" });
  updateUserActivity(msg.from.id, "Statistikani ko'rdi");
});

// /addbook komandasi (admin uchun)
bot.onText(/\/addbook/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, translations[lang].noPermission, getMainMenu(lang));
    return;
  }

  sendMonitoringInfo("Kitob qo'shish bo'limiga kirdi", user);

  waitingForBook[chatId] = { step: "waiting_for_book_name" };
  bot.sendMessage(
    chatId, 
    lang === "uz" ? "📖 Kitob nomini kiriting:" : lang === "ru" ? "📖 Введите название книги:" : "📖 Enter book name:",
    getBackMenu(lang)
  );
  updateUserActivity(msg.from.id, "Kitob qo'shish boshladi");
});

// /addreklama komandasi (admin uchun)
bot.onText(/\/addreklama/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, translations[lang].noPermission, getMainMenu(lang));
    return;
  }

  sendMonitoringInfo("Reklama qo'shish bo'limiga kirdi", user);

  waitingForAd[chatId] = { step: "waiting_for_ad_content" };
  bot.sendMessage(
    chatId, 
    lang === "uz" 
      ? "📢 Reklama kontentini yuboring (matn, rasm, video yoki hujjat):" 
      : lang === "ru" 
      ? "📢 Отправьте контент рекламы (текст, изображение, видео или документ):" 
      : "📢 Send ad content (text, photo, video or document):",
    getBackMenu(lang)
  );
  updateUserActivity(msg.from.id, "Reklama qo'shish boshladi");
});

// /users komandasi (admin uchun)
bot.onText(/\/users/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, translations[lang].noPermission, getMainMenu(lang));
    return;
  }

  sendMonitoringInfo("Foydalanuvchilar ro'yxatini ko'rdi", user);

  if (users.length === 0) {
    bot.sendMessage(chatId, lang === "uz" ? "❌ Foydalanuvchilar topilmadi." : lang === "ru" ? "❌ Пользователи не найдены." : "❌ No users found.", getMainMenu(lang));
    return;
  }

  let message = lang === "uz" 
    ? `👥 Foydalanuvchilar soni: ${users.length}\n\n`
    : lang === "ru" 
    ? `👥 Количество пользователей: ${users.length}\n\n` 
    : `👥 Total users: ${users.length}\n\n`;

  const recentUsers = users.slice(-10).reverse();

  recentUsers.forEach((user, index) => {
    message += `${index + 1}. ${user.first_name} ${user.last_name || ''} (@${user.username || 'N/A'})\n`;
    message += `🆔: ${user.id}\n`;
    message += `📅 Qo'shilgan: ${new Date(user.joined_at).toLocaleString()}\n`;
    message += `🌐 ${user.language?.toUpperCase() || 'UZ'}\n\n`;
  });

  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ 
          text: lang === "uz" ? "📥 Foydalanuvchilarni yuklab olish" : lang === "ru" ? "📥 Скачать список" : "📥 Download list", 
          callback_data: "download_users" 
        }],
        [{ 
          text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", 
          callback_data: "back_to_main" 
        }]
      ]
    }
  });
  updateUserActivity(msg.from.id, "Foydalanuvchilar ro'yxatini ko'rdi");
});

// Xabarlarni qayta ishlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  if (!text) return;

  // Monitoring uchun harakatlarni yuborish
  if (text === translations[lang].searchBook) {
    sendMonitoringInfo("Kitob qidirish bo'limiga kirdi", user);
  } else if (text === translations[lang].allBooks) {
    sendMonitoringInfo("Barcha kitoblar bo'limiga kirdi", user);
  } else if (text === translations[lang].settings) {
    sendMonitoringInfo("Sozlamalar bo'limiga kirdi", user);
  } else if (text && !text.startsWith('/')) {
    sendMonitoringInfo("Kitob qidiruv so'rovi", user, { sorov: text });
  }

  // Orqaga tugmasi
  if (text === translations[lang].back) {
    bot.sendMessage(chatId, translations[lang].back, getMainMenu(lang));
    updateUserActivity(msg.from.id, "Orqaga qaytdi");
    return;
  }

  // Asosiy menyu tugmasi
  if (text === translations[lang].mainMenu) {
    bot.sendMessage(chatId, translations[lang].mainMenu, getMainMenu(lang));
    updateUserActivity(msg.from.id, "Asosiy menyuga qaytdi");
    return;
  }

  // Kitob qidirish
  if (text === translations[lang].searchBook) {
    bot.sendMessage(chatId, lang === "uz" ? "📚 Kitob nomi, muallif yoki janr bo'yicha qidiring." : lang === "ru" ? "📚 Введите название книги, автора или жанр." : "📚 Search by name, author or genre.", getBackMenu(lang));
    updateUserActivity(msg.from.id, "Kitob qidirishni boshladi");
    return;
  }

  // Barcha kitoblar
  if (text === translations[lang].allBooks) {
    bot.sendMessage(chatId, lang === "uz" ? "Janrni tanlang:" : lang === "ru" ? "Выберите жанр:" : "Choose genre:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Podkast", callback_data: "genre_Podkast" }, { text: "Audio Dars", callback_data: "genre_Audio Dars" }],
          [{ text: "Badiiy", callback_data: "genre_Badiiy" }, { text: "Ilmiy", callback_data: "genre_Ilmiy" }],
          [{ text: "Darslik", callback_data: "genre_Darslik" }, { text: "Boshqa", callback_data: "genre_Boshqa" }],
          [{ text: "Shaxsiy Rivojlanish", callback_data: "genre_Shaxsiy Rivojlanish" }],
          [{ text: "Detektiv", callback_data: "genre_Detektiv" }],
          [{ text: lang === "uz" ? "Barchasi" : lang === "ru" ? "Все" : "All", callback_data: "genre_all" }],
          [{ text: translations[lang].back, callback_data: "back_to_main" }],
        ],
      },
    });
    updateUserActivity(msg.from.id, "Barcha kitoblar bo'limiga kirdi");
    return;
  }

  // Kitob qo'shish jarayoni
  if (waitingForBook[chatId] && ADMIN_IDS.includes(msg.from.id.toString())) {
    if (waitingForBook[chatId].step === "waiting_for_book_name") {
      waitingForBook[chatId].name = text;
      waitingForBook[chatId].step = "waiting_for_book_author";
      bot.sendMessage(
        chatId, 
        lang === "uz" ? "✍️ Muallifni kiriting:" : lang === "ru" ? "✍️ Введите автора:" : "✍️ Enter author:",
        getBackMenu(lang)
      );
      updateUserActivity(msg.from.id, "Kitob nomini kiritdi");
      return;
    }

    if (waitingForBook[chatId].step === "waiting_for_book_author") {
      waitingForBook[chatId].author = text;
      waitingForBook[chatId].step = "waiting_for_book_genre";
      bot.sendMessage(
        chatId, 
        lang === "uz" ? "📂 Janrni tanlang:" : lang === "ru" ? "📂 Выберите жанр:" : "📂 Choose genre:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Podkast", callback_data: "book_genre_Podkast" }, { text: "Audio Dars", callback_data: "book_genre_Audio Dars" }],
              [{ text: "Badiiy", callback_data: "book_genre_Badiiy" }, { text: "Ilmiy", callback_data: "book_genre_Ilmiy" }],
              [{ text: "Darslik", callback_data: "book_genre_Darslik" }, { text: "Boshqa", callback_data: "book_genre_Boshqa" }],
              [{ text: "Shaxsiy Rivojlanish", callback_data: "book_genre_Shaxsiy Rivojlanish" }],
              [{ text: "Detektiv", callback_data: "book_genre_Detektiv" }],
              [{ text: translations[lang].back, callback_data: "back_to_main" }],
            ],
          },
        }
      );
      updateUserActivity(msg.from.id, "Kitob muallifini kiritdi");
      return;
    }
  }

  // Reklama jarayoni
  if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
    if (text) {
      waitingForAd[chatId].text = text;
      waitingForAd[chatId].step = "waiting_for_ad_confirmation";

      const previewText = lang === "uz" 
        ? "📢 Reklama namoyishi:\n\n" + waitingForAd[chatId].text
        : lang === "ru" 
        ? "📢 Превью объявления:\n\n" + waitingForAd[chatId].text
        : "📢 Ad preview:\n\n" + waitingForAd[chatId].text;

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

      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "✅ Reklamani yuborishni tasdiqlaysizmi?" 
          : lang === "ru" 
          ? "✅ Подтверждаете отправку?" 
          : "✅ Confirm sending?",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "uz" ? "✅ Tasdiqlash" : lang === "ru" ? "✅ Подтвердить" : "✅ Confirm", callback_data: "confirm_ad" }],
              [{ text: lang === "uz" ? "❌ Bekor qilish" : lang === "ru" ? "❌ Отменить" : "❌ Cancel", callback_data: "cancel_ad" }],
              [{ text: translations[lang].back, callback_data: "back_to_main" }],
            ],
          },
        }
      );
      updateUserActivity(msg.from.id, "Reklama matnini kiritdi");
    }
    return;
  }

  // Kitob qidiruv funksiyasi
  if (text !== "/start") {
    const results = books.filter(
      (b) => b.id === text || 
             b.name.toLowerCase().includes(text.toLowerCase()) || 
             b.author?.toLowerCase().includes(text.toLowerCase()) || 
             b.genre?.toLowerCase().includes(text.toLowerCase())
    );

    if (results.length) {
      results.forEach((book) => {
        let caption = `📖 *${book.name}*\n👤 *${lang === "uz" ? "Muallif" : lang === "ru" ? "Автор" : "Author"}:* ${book.author}\n📂 *${lang === "uz" ? "Janr" : lang === "ru" ? "Жанр" : "Genre"}:* ${book.genre}\n\n${CHANNEL_LINK}`;
        
        if (book.file_id) {
          const options = { 
            caption, 
            parse_mode: "Markdown",
            reply_markup: getBackMenu(lang).reply_markup
          };

          switch(book.file_type) {
            case "document":
              bot.sendDocument(chatId, book.file_id, options);
              break;
            case "photo":
              bot.sendPhoto(chatId, book.file_id, options);
              break;
            case "video":
              bot.sendVideo(chatId, book.file_id, options);
              break;
            case "audio":
              bot.sendAudio(chatId, book.file_id, options);
              break;
            case "voice":
              bot.sendVoice(chatId, book.file_id, options);
              break;
          }
        } else {
          bot.sendMessage(
            chatId, 
            `⚠️ ${book.name} ${lang === "uz" ? "kitobi mavjud, lekin fayli yo'q." : lang === "ru" ? "есть, но файл отсутствует." : "exists but file is missing."}`, 
            { 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            }
          );
        }
      });
    } else {
      bot.sendMessage(
        chatId, 
        translations[lang].bookNotFound,
        getBackMenu(lang)
      );
    }
    updateUserActivity(msg.from.id, `"${text}" bo'yicha qidiruv`);
  }
});

// Fayllarni qayta ishlash
bot.on("document", (msg) => processFile(msg, "document"));

bot.on("photo", (msg) => processFile(msg, "photo"));
bot.on("video", (msg) => processFile(msg, "video"));
bot.on("audio", (msg) => processFile(msg, "audio"));
bot.on("voice", (msg) => processFile(msg, "voice"));

async function processFile(msg, type) {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  // Reklama fayli uchun
  if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
    let file_id = type === "photo" ? msg.photo[msg.photo.length - 1].file_id : msg[type].file_id;
    waitingForAd[chatId].file_id = file_id;
    waitingForAd[chatId].file_type = type;

    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "📝 Reklama uchun matn yozing:" 
        : lang === "ru" 
        ? "📝 Напишите текст объявления:" 
        : "📝 Write ad text:",
      getBackMenu(lang)
    );
    updateUserActivity(msg.from.id, "Reklama faylini yubordi");
    return;
  }

  // Kitob fayli uchun
  if (waitingForBook[chatId] && waitingForBook[chatId].step === "waiting_for_book_file" && ADMIN_IDS.includes(msg.from.id.toString())) {
    let file_id = type === "photo" ? msg.photo[msg.photo.length - 1].file_id : msg[type].file_id;
    waitingForBook[chatId].file_id = file_id;
    waitingForBook[chatId].file_type = type;

    // Agar rasm yuborilgan bo'lsa, kitob faylini so'raymiz
    if (type === "photo") {
      waitingForBook[chatId].image_id = file_id;
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "📄 Kitob faylini (PDF yoki boshqa formatda) yuboring:" 
          : lang === "ru" 
          ? "📄 Отправьте файл книги (PDF или другой формат):" 
          : "📄 Send book file (PDF or other):",
        getBackMenu(lang)
      );
    } else {
      // Kitobni qo'shamiz
      const newBook = addBook(waitingForBook[chatId]);

      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? `✅ Kitob qo'shildi!\n\n📖 Nomi: ${newBook.name}\n👤 Muallif: ${newBook.author}\n📂 Janr: ${newBook.genre}` 
          : lang === "ru" 
          ? `✅ Книга добавлена!\n\n📖 Название: ${newBook.name}\n👤 Автор: ${newBook.author}\n📂 Жанр: ${newBook.genre}` 
          : `✅ Book added!\n\n📖 Name: ${newBook.name}\n👤 Author: ${newBook.author}\n📂 Genre: ${newBook.genre}`,
        getMainMenu(lang)
      );

      delete waitingForBook[chatId];
    }
    updateUserActivity(msg.from.id, "Kitob faylini yubordi");
    return;
  }
}

// Callback query handler
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const user = users.find(u => u.id === query.from.id);
  const lang = user?.language || 'uz';
  const data = query.data;

  // Til tanlash
  if (["uz", "ru", "en"].includes(data)) {
    updateUserLanguage(query.from.id, data);
    bot.sendMessage(chatId, data === "uz" ? "Til tanlandi!" : data === "ru" ? "Язык выбран!" : "Language selected!", getMainMenu(data));
    updateUserActivity(query.from.id, `Tilni ${data} ga o'zgartirdi`);
    return;
  }

  // Kitoblar ro'yxati uchun janr tanlash
  if (data.startsWith("genre_")) {
    const genre = data.replace("genre_", "");
    let filteredBooks = genre === "all" ? books : books.filter((b) => b.genre === genre);

    if (filteredBooks.length) {
      let message = lang === "uz" ? "📚 Kitoblar ro'yxati:" : lang === "ru" ? "📚 Список книг:" : "📚 Books list:";
      filteredBooks.forEach((book, index) => {
        message += `\n\n${index + 1}. *${book.name}* (${book.author})\n📂 ${lang === "uz" ? "Janr" : lang === "ru" ? "Жанр" : "Genre"}: ${book.genre}\n🆔 ID: ${book.id}`;
      });
      bot.sendMessage(chatId, message, { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }]
          ]
        }
      });
    } else {
      bot.sendMessage(
        chatId, 
        lang === "uz" ? "❌ Ushbu janrda kitob yo'q." : lang === "ru" ? "❌ Нет книг в этом жанре." : "❌ No books in this genre.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }]
            ]
          }
        }
      );
    }
    updateUserActivity(query.from.id, `${genre} janridagi kitoblarni ko'rdi`);
    return;
  }

  // Kitob qo'shish uchun janr tanlash
  if (data.startsWith("book_genre_")) {
    const genre = data.replace("book_genre_", "");
    waitingForBook[chatId].genre = genre;
    waitingForBook[chatId].step = "waiting_for_book_file";

    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "🖼 Kitob uchun rasm yuboring:" 
        : lang === "ru" 
        ? "🖼 Отправьте изображение для книги:" 
        : "🖼 Send image for book:",
      getBackMenu(lang)
    );
    updateUserActivity(query.from.id, "Kitob janrini tanladi");
    return;
  }

  // Reklamani tasdiqlash
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
    saveAds();

    broadcastAd(newAd);

    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "✅ Reklama yuborildi!" 
        : lang === "ru" 
        ? "✅ Объявление отправлено!" 
        : "✅ Ad sent!",
      getMainMenu(lang)
    );

    delete waitingForAd[chatId];
    updateUserActivity(query.from.id, "Reklamani tasdiqladi");
    return;
  }

  // Reklamani bekor qilish
  if (data === "cancel_ad") {
    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "❌ Reklama bekor qilindi." 
        : lang === "ru" 
        ? "❌ Объявление отменено." 
        : "❌ Ad canceled.",
      getMainMenu(lang)
    );
    delete waitingForAd[chatId];
    updateUserActivity(query.from.id, "Reklamani bekor qildi");
    return;
  }

  // Foydalanuvchilarni yuklab olish
  if (data === "download_users") {
    try {
      const csvContent = "ID,Username,First Name,Last Name,Language,Joined At,Last Active\n" +
        users.map(user => 
          `${user.id},${user.username || ''},${user.first_name},${user.last_name || ''},${user.language || 'uz'},${user.joined_at},${user.last_active}`
        ).join("\n");

      fs.writeFileSync(path.join(__dirname, "users.csv"), csvContent);

      await bot.sendDocument(chatId, path.join(__dirname, "users.csv"), {
        caption: lang === "uz" 
          ? "📊 Foydalanuvchilar ro'yxati" 
          : lang === "ru" 
          ? "📊 Список пользователей" 
          : "📊 Users list",
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }]
          ]
        }
      });

      fs.unlinkSync(path.join(__dirname, "users.csv"));
    } catch (error) {
      console.error("Xato:", error);
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "❌ Foydalanuvchilarni yuklab bo'lmadi." 
          : lang === "ru" 
          ? "❌ Не удалось загрузить пользователей." 
          : "❌ Failed to download users.",
        getMainMenu(lang)
      );
    }
    updateUserActivity(query.from.id, "Foydalanuvchilarni yuklashga urindi");
    return;
  }

  // Asosiy menyuga qaytish
  if (data === "back_to_main") {
    bot.sendMessage(
      chatId, 
      lang === "uz" ? "Asosiy menyu" : lang === "ru" ? "Главное меню" : "Main menu", 
      getMainMenu(lang)
    );
    updateUserActivity(query.from.id, "Asosiy menyuga qaytdi");
    return;
  }
});

// Monitoring bot uchun start komandasi
monitoringBot.onText(/\/start/, (msg) => {
  monitoringBot.sendMessage(msg.chat.id, "👮‍♂️ Bu bot faqat monitoring uchun ishlatiladi. U kutubxona botidagi harakatlarni kuzatib boradi va adminlarga xabar beradi.");
});

console.log("✅ Kutubxona boti ishga tushdi...");
console.log("✅ Monitoring boti ishga tushdi...");