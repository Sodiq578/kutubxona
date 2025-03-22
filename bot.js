require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const books = require("./books.json");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_ID.split(",").map((id) => id.trim()); // Bir nechta adminlar
const bot = new TelegramBot(TOKEN, { polling: true });

const waitingForBook = {};
const userLanguage = {}; // Foydalanuvchi tilini saqlash uchun

// Til tanlash menyusi
const languageMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🇺🇿 O'zbekcha", callback_data: "uz" }],
      [{ text: "🇷🇺 Русский", callback_data: "ru" }],
      [{ text: "🇬🇧 English", callback_data: "en" }],
    ],
  },
};

// Asosiy menyu (tilga qarab o'zgaradi)
function getMainMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [lang === "uz" ? "📚 Kitob qidirish" : lang === "ru" ? "📚 Поиск книги" : "📚 Search book"],
        [lang === "uz" ? "📂 Barcha kitoblar" : lang === "ru" ? "📂 Все книги" : "📂 All books"],
        [lang === "uz" ? "⚙️ Sozlamalar" : lang === "ru" ? "⚙️ Настройки" : "⚙️ Settings"],
      ],
      resize_keyboard: true,
    },
  };
}

// Orqaga qaytish menyusi (tilga qarab o'zgaradi)
function getBackMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back"],
        [lang === "uz" ? "🏠 Asosiy menyu" : lang === "ru" ? "🏠 Главное меню" : "🏠 Main menu"],
      ],
      resize_keyboard: true,
    },
  };
}

// Fayl yuborilganda "Ulashish" va "Orqaga qaytish" tugmalari
function getFileOptions(lang) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === "uz" ? "📤 Ulashish" : lang === "ru" ? "📤 Поделиться" : "📤 Share", callback_data: "share" }],
        [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back" }],
      ],
    },
  };
}

// Botni ishga tushirish
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Tilni tanlang / Выберите язык / Choose language:", languageMenu);
});

// Tilni tanlash
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const lang = query.data;

  if (["uz", "ru", "en"].includes(lang)) {
    userLanguage[chatId] = lang; // Tilni saqlash
    bot.sendMessage(chatId, lang === "uz" ? "Til tanlandi!" : lang === "ru" ? "Язык выбран!" : "Language selected!", getMainMenu(lang));
  }
});

// Xabarlarni qayta ishlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const lang = userLanguage[chatId] || "uz"; // Agar til tanlanmagan bo'lsa, default til

  if (!text) return;

  // Admin uchun maxsus buyruq
  if (text === "/sodiq191929" && ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, lang === "uz" ? "📂 Yangi faylni jo‘nating." : lang === "ru" ? "📂 Отправьте новый файл." : "📂 Send a new file.", getBackMenu(lang));
    waitingForBook[chatId] = { step: "waiting_for_file" };
    return;
  }

  // Kitob qidirish
  if (text === (lang === "uz" ? "📚 Kitob qidirish" : lang === "ru" ? "📚 Поиск книги" : "📚 Search book")) {
    bot.sendMessage(chatId, lang === "uz" ? "📚 Kitob nomi, muallif yoki janr bo‘yicha qidiring." : lang === "ru" ? "📚 Введите название книги, автора или жанр." : "📚 Search by book name, author, or genre.", getBackMenu(lang));
    return;
  }

  // Barcha kitoblarni ko'rsatish
  if (text === (lang === "uz" ? "📂 Barcha kitoblar" : lang === "ru" ? "📂 Все книги" : "📂 All books")) {
    bot.sendMessage(chatId, lang === "uz" ? "Janrni tanlang:" : lang === "ru" ? "Выберите жанр:" : "Choose the genre:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Podkast", callback_data: "genre_Podkast" }, { text: "Audio Dars", callback_data: "genre_Audio Dars" }],
          [{ text: "Badiiy", callback_data: "genre_Badiiy" }, { text: "Ilmiy", callback_data: "genre_Ilmiy" }],
          [{ text: "Darslik", callback_data: "genre_Darslik" }, { text: "Boshqa", callback_data: "genre_Boshqa" }],
          [{ text: lang === "uz" ? "Barchasi" : lang === "ru" ? "Все" : "All", callback_data: "genre_all" }],
        ],
      },
    });
    return;
  }

  // Sozlamalar
  if (text === (lang === "uz" ? "⚙️ Sozlamalar" : lang === "ru" ? "⚙️ Настройки" : "⚙️ Settings")) {
    bot.sendMessage(chatId, lang === "uz" ? "Sozlamalar bo'limi" : lang === "ru" ? "Раздел настроек" : "Settings section", getBackMenu(lang));
    return;
  }

  // Orqaga qaytish
  if (text === (lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back")) {
    bot.sendMessage(chatId, lang === "uz" ? "Oldingi bosqichga qaytildi." : lang === "ru" ? "Возврат к предыдущему шагу." : "Returned to the previous step.", getBackMenu(lang));
    return;
  }

  // Asosiy menyu
  if (text === (lang === "uz" ? "🏠 Asosiy menyu" : lang === "ru" ? "🏠 Главное меню" : "🏠 Main menu")) {
    bot.sendMessage(chatId, lang === "uz" ? "Asosiy menyu" : lang === "ru" ? "Главное меню" : "Main menu", getMainMenu(lang));
    return;
  }

  // Kitob qidirish
  if (text !== "/start") { // Faqat kitob qidirish bosqichida xabar chiqarish
    const results = books.filter(
      (b) => b.id === text || b.name.toLowerCase().includes(text.toLowerCase()) || b.author?.toLowerCase().includes(text.toLowerCase()) || b.genre?.toLowerCase().includes(text.toLowerCase())
    );

    if (results.length) {
      results.forEach((book) => sendBook(chatId, book, lang));
    } else {
      bot.sendMessage(chatId, lang === "uz" ? "❌ Kitob topilmadi." : lang === "ru" ? "❌ Книга не найдена." : "❌ Book not found.");
    }
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
  const lang = userLanguage[chatId] || "uz";

  if (!waitingForBook[chatId] || waitingForBook[chatId].step !== "waiting_for_file" || !ADMIN_IDS.includes(msg.from.id.toString())) return;

  let file_id = type === "photo" ? msg.photo[msg.photo.length - 1].file_id : msg[type].file_id;
  waitingForBook[chatId] = { file_id, file_type: type, step: "waiting_for_name" };
  bot.sendMessage(chatId, lang === "uz" ? "📖 Fayl nomini kiriting:" : lang === "ru" ? "📖 Введите название файла:" : "📖 Enter the file name:", getBackMenu(lang));
}

// Fayl nomi, muallif va boshqa ma'lumotlarni qayta ishlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const lang = userLanguage[chatId] || "uz";

  if (!waitingForBook[chatId] || !ADMIN_IDS.includes(msg.from.id.toString())) return;

  const text = msg.text?.trim();
  const step = waitingForBook[chatId].step;

  if (step === "waiting_for_name") {
    waitingForBook[chatId].name = text;
    bot.sendMessage(chatId, lang === "uz" ? "🖊 Muallif ismini kiriting:" : lang === "ru" ? "🖊 Введите имя автора:" : "🖊 Enter the author's name:", getBackMenu(lang));
    waitingForBook[chatId].step = "waiting_for_author";
  } else if (step === "waiting_for_author") {
    waitingForBook[chatId].author = text;
    bot.sendMessage(chatId, lang === "uz" ? "🔢 Kitob kodini kiriting:" : lang === "ru" ? "🔢 Введите код книги:" : "🔢 Enter the book code:", getBackMenu(lang));
    waitingForBook[chatId].step = "waiting_for_id";
  } else if (step === "waiting_for_id") {
    waitingForBook[chatId].id = text;
    bot.sendMessage(chatId, lang === "uz" ? "📚 Janrni tanlang:" : lang === "ru" ? "📚 Выберите жанр:" : "📚 Choose the genre:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Podkast", callback_data: "Podkast" }, { text: "Audio Dars", callback_data: "Audio Dars" }],
          [{ text: "Badiiy", callback_data: "Badiiy" }, { text: "Ilmiy", callback_data: "Ilmiy" }],
          [{ text: "Darslik", callback_data: "Darslik" }, { text: "Boshqa", callback_data: "Boshqa" }],
        ],
      },
    });
    waitingForBook[chatId].step = "waiting_for_type";
  }
});

// Janrni tanlash
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const lang = userLanguage[chatId] || "uz";
  const data = query.data;

  // Janrni tanlash
  if (data.startsWith("genre_")) {
    const genre = data.replace("genre_", "");
    let filteredBooks = genre === "all" ? books : books.filter((b) => b.genre === genre);

    if (filteredBooks.length) {
      let message = lang === "uz" ? "📚 Kitoblar ro'yxati:" : lang === "ru" ? "📚 Список книг:" : "📚 List of books:";
      filteredBooks.forEach((book, index) => {
        message += `\n\n${index + 1}. *${book.name}* (${book.author})\n📂 ${lang === "uz" ? "Janr" : lang === "ru" ? "Жанр" : "Genre"}: ${book.genre}\n🆔 ID: ${book.id}`;
      });
      bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, lang === "uz" ? "❌ Ushbu janrda kitob topilmadi." : lang === "ru" ? "❌ Книги в этом жанре не найдены." : "❌ No books found in this genre.");
    }
    return;
  }

  // Kitob qo'shish uchun janrni tanlash
  if (waitingForBook[chatId] && waitingForBook[chatId].step === "waiting_for_type") {
    waitingForBook[chatId].genre = data;
    saveBook(chatId, lang);
  }
});

// Kitobni saqlash
function saveBook(chatId, lang) {
  if (!ADMIN_IDS.includes(chatId.toString())) return;

  const newBook = waitingForBook[chatId];
  books.push({ id: newBook.id, name: newBook.name, author: newBook.author, genre: newBook.genre, file_id: newBook.file_id, file_type: newBook.file_type });
  fs.writeFileSync(path.join(__dirname, "books.json"), JSON.stringify(books, null, 2));
  bot.sendMessage(chatId, lang === "uz" ? `✅ *${newBook.name}* (${newBook.author}) bazaga qo‘shildi!` : lang === "ru" ? `✅ *${newBook.name}* (${newBook.author}) добавлено в базу!` : `✅ *${newBook.name}* (${newBook.author}) added to the database!`, { parse_mode: "Markdown" });
  delete waitingForBook[chatId];
}

// Kitobni yuborish
function sendBook(chatId, book, lang) {
  let caption = `📖 *${book.name}*\n👤 *${lang === "uz" ? "Muallif" : lang === "ru" ? "Автор" : "Author"}:* ${book.author}\n📂 *${lang === "uz" ? "Janr" : lang === "ru" ? "Жанр" : "Genre"}:* ${book.genre}`;
  if (book.file_id) {
    if (book.file_type === "document") bot.sendDocument(chatId, book.file_id, { caption, parse_mode: "Markdown", ...getFileOptions(lang) });
    else if (book.file_type === "photo") bot.sendPhoto(chatId, book.file_id, { caption, parse_mode: "Markdown", ...getFileOptions(lang) });
    else if (book.file_type === "video") bot.sendVideo(chatId, book.file_id, { caption, parse_mode: "Markdown", ...getFileOptions(lang) });
    else if (book.file_type === "audio") bot.sendAudio(chatId, book.file_id, { caption, parse_mode: "Markdown", ...getFileOptions(lang) });
    else if (book.file_type === "voice") bot.sendVoice(chatId, book.file_id, { caption, parse_mode: "Markdown", ...getFileOptions(lang) });
  } else {
    bot.sendMessage(chatId, `⚠️ ${book.name} ${lang === "uz" ? "mavjud, lekin fayli yo‘q." : lang === "ru" ? "есть, но файл отсутствует." : "exists, but the file is missing."}`, { parse_mode: "Markdown" });
  }
}

console.log("✅ Bot ishga tushdi...");