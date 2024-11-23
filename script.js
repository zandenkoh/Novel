// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyAaYarZ9GRra00k3-bZ3i3Yq7Z29JKBGlQ",
  authDomain: "chat-f6c20.firebaseapp.com",
  databaseURL: "https://chat-f6c20-default-rtdb.firebaseio.com",
  projectId: "chat-f6c20",
  storageBucket: "chat-f6c20.appspot.com",
  messagingSenderId: "589761348145",
  appId: "1:589761348145:web:3e23e78556f53704198b10"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

let userIP;

// Fetch IP Address
fetch('https://api.ipify.org?format=json')
  .then(response => response.json())
  .then(data => {
    userIP = data.ip;
    createUserIfNotExists(userIP);
    updateGoalTime(userIP);
    fetchBooks(userIP); // Fetch and display books on page load
  })
  .catch(err => console.error(err));

// Create User if Not Exists
function createUserIfNotExists(ip) {
  const userRef = db.collection('users').doc(ip);
  userRef.get().then((doc) => {
    if (!doc.exists) {
      userRef.set({
        goalTime: 30,
        timeToday: 0
      });
    }
  });
}

// Fetch and display all books from Firestore
function fetchBooks(ip) {
  const userRef = db.collection('users').doc(ip);
  userRef.collection('books').get().then((querySnapshot) => {
    const uploadedBooksContainer = document.getElementById('uploaded-books-container');
    uploadedBooksContainer.innerHTML = ''; // Clear any existing books

    // Create "Add Book" card only if it doesn't exist
    if (!document.querySelector('.add-book-card')) {
      const addBookCard = createAddBookCard();
      uploadedBooksContainer.appendChild(addBookCard);
    }

    querySnapshot.forEach(doc => {
      const bookData = doc.data();
      displayUploadedBook(bookData.title, bookData.url, bookData.fileType);
    });
  }).catch((error) => {
    console.error("Error fetching books: ", error);
  });
}

function displayUploadedBook(fileName, fileURL, fileType) {
  const uploadedBooksContainer = document.getElementById('uploaded-books-container');
  
  // Create a new book card
  const bookCard = document.createElement('div');
  bookCard.classList.add('book-card');
  
  const bookLink = document.createElement('a');
  bookLink.href = fileURL;
  bookLink.target = "_blank";
  
  // Check if the book is a PDF
  if (fileType === 'pdf') {
    // Create a canvas element to render the first page of the PDF
    const bookCover = createBookCover(fileName, fileURL); // Adjusted to pass fileURL
    bookLink.appendChild(bookCover);
  } else {
    const bookPreview = document.createElement('img');
    bookPreview.src = fileURL;
    bookPreview.alt = "Book Preview";
    bookPreview.style.width = "1024px";
    bookPreview.style.height = "768px";
    bookLink.appendChild(bookPreview);
  }
  
  // Create a title element
  const bookText = document.createElement('p');
  bookText.textContent = fileName.length > 20 ? fileName.slice(0, 17) + "..." : fileName; // Truncate title if too long
  
  // Append elements to the book card
  bookLink.appendChild(bookText);
  bookCard.appendChild(bookLink);
  
  // Append the book card to the container
  uploadedBooksContainer.appendChild(bookCard);
}


// Create the "Add Book" card
function createAddBookCard() {
  const addBookCard = document.createElement('div');
  addBookCard.classList.add('book-card', 'add-book-card');
  
  const addBookButton = document.createElement('button');
  addBookButton.textContent = '+ Add Book';
  addBookButton.onclick = triggerFileUpload;
  
  addBookCard.appendChild(addBookButton);
  return addBookCard;
}

// Trigger file input
function triggerFileUpload() {
  document.getElementById('file-upload').click();
}

// Handle file upload
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Upload the file to Firebase Storage
  const storageRef = storage.ref(`books/${file.name}`);
  const uploadTask = storageRef.put(file);

  uploadTask.on('state_changed', 
    function(snapshot) {
      // You can add progress indicators here if needed
    }, 
    function(error) {
      console.error("Error uploading file:", error);
    }, 
    function() {
      // Get the download URL after the upload is complete
      uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
        console.log("File available at:", downloadURL);
        
        // Determine the file type (PDF or image) and add to Firestore
        const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'image';
        addBookToFirestore(userIP, file.name, downloadURL, fileType);
      });
    }
  );
}

// Add the uploaded book to Firestore under the 'books' collection
function addBookToFirestore(ip, fileName, fileURL, fileType) {
  const userRef = db.collection('users').doc(ip);

  // Create a new book document inside the 'books' sub-collection
  userRef.collection('books').doc(fileName).set({
    title: fileName,
    url: fileURL,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    fileType: fileType
  }).then(() => {
    console.log("Book added to Firestore!");
    // Display the uploaded book in the UI
    displayUploadedBook(fileName, fileURL, fileType);
  }).catch(error => {
    console.error("Error adding book to Firestore:", error);
  });
}

// Create book cover for PDF (rendering first page of PDF)
function createBookCover(fileName, fileURL) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Load the PDF
  const loadingTask = pdfjsLib.getDocument(fileURL);
  loadingTask.promise.then(function(pdf) {
    console.log('PDF loaded');
    
    // Get the first page of the PDF
    pdf.getPage(1).then(function(page) {
      const scale = 1.5;  // Scale for rendering the PDF
      const viewport = page.getViewport({ scale: scale });

      // Set canvas size to match the viewport size
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render the page to the canvas
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      page.render(renderContext).promise.then(function() {
        console.log('Page rendered');

        // Once the page is rendered, find the card and append the canvas to the book link
        const bookCard = document.querySelector(`[data-file="${fileName}"]`);
        if (bookCard) {
          const bookLink = bookCard.querySelector('a');
          bookLink.insertBefore(canvas, bookLink.firstChild); // Insert the canvas as the first child
        }
      });
    });
  }, function(error) {
    console.error('Error loading PDF:', error);
  });

  return canvas; // Return the canvas immediately, but it will be updated asynchronously
}


// Display uploaded book (adjusted to work with PDF)
function displayUploadedBook(fileName, fileURL, fileType) {
  const uploadedBooksContainer = document.getElementById('uploaded-books-container');
  
  // Create a new book card
  const bookCard = document.createElement('div');
  bookCard.classList.add('book-card');
  bookCard.setAttribute('data-file', fileName); // Add a custom data attribute to the card

  const bookLink = document.createElement('a');
  bookLink.href = fileURL;
  bookLink.target = "_blank";

  // Check if the book is a PDF
  if (fileType === 'pdf') {
    // Create the cover for the PDF by passing the fileURL for rendering
    createBookCover(fileName, fileURL); // Handle PDF rendering asynchronously
  } else {
    const bookPreview = document.createElement('img');
    bookPreview.src = fileURL;
    bookPreview.alt = "Book Preview";
    bookPreview.style.width = "1024px";
    bookPreview.style.height = "768px";
    bookLink.appendChild(bookPreview);
  }
  
  // Create a title element
  const bookText = document.createElement('p');
  bookText.textContent = fileName.length > 20 ? fileName.slice(0, 17) + "..." : fileName; // Truncate title if too long
  
  // Append elements to the book card
  bookLink.appendChild(bookText);
  bookCard.appendChild(bookLink);
  
  // Append the book card to the container
  uploadedBooksContainer.appendChild(bookCard);
}


// Function to render the PDF onto a canvas
function renderPDFToCanvas(pdfURL, canvasId) {
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.js';
  
  const loadingTask = pdfjsLib.getDocument(pdfURL);
  loadingTask.promise.then(function(pdf) {
    console.log('PDF loaded');

    const pageNumber = 1;  // Render the first page
    pdf.getPage(pageNumber).then(function(page) {
      console.log('Page loaded');

      const scale = 1.1;  // Adjust scale to fit the canvas size
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.getElementById(canvasId);
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTask.promise.then(function() {
        console.log('Page rendered');
      });
    });
  }, function(error) {
    console.error('Error loading PDF:', error);
  });
}



// Set progress circle
function setProgressCircle(percentage) {
  const circle = document.querySelector('.progress-ring__circle');
  const radius = 8; // Matches the r attribute in the SVG
  const circumference = 2 * Math.PI * radius; // ~60.31

  // Calculate offset for the given percentage
  const offset = circumference - (percentage / 100) * circumference;
  circle.style.strokeDashoffset = offset; // Set the offset dynamically
}

// Fetch progress dynamically and update the UI
function updateGoalTime(ip) {
  const userRef = db.collection('users').doc(ip);

  userRef.onSnapshot((doc) => {
    if (doc.exists) {
      const { goalTime, timeToday } = doc.data();
      const percentage = (timeToday / goalTime) * 100;
      const minutesLeft = goalTime - timeToday;

      // Update the progress ring
      setProgressCircle(percentage);

      // Update time left text
      document.getElementById('minutes-left').textContent = `${minutesLeft} minutes left`;
      
      document.getElementById('loading-popup').classList.add('hidden');
      loadingPopup.classList.add('hidden');
    } else {
      console.error("User data does not exist");
    }
  });
}
