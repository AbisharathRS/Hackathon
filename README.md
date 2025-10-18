GitHub README & Setup Guide
A full-stack web application featuring a modern shopping cart, secure user authentication, and real-time discount coupons. Built with Node.js, Express, MongoDB, and a responsive front-end.
Features
•	User registration & login (JWT-based authentication)
•	Add, update, and remove items from the cart
•	Apply, validate, and manage coupon codes
•	Product catalog with admin management
•	Real-time updates for cart totals and discounts
•	Responsive design for desktop & mobile
Tech Stack
•	Frontend: HTML, CSS, JavaScript (can integrate React/Redux)
•	Backend: Node.js, Express.js
•	Database: MongoDB, Mongoose
•	Authentication: JWT, bcrypt
•	Deployment: Vercel/Netlify (frontend), Render/AWS (backend)
Installation
1.	Clone the repository : git clone https://github.com/your-username/your-repo-name.git
2.	Install backend dependencies :  npm install
3.	npm install : npm start
API Endpoints
•	/api/products – List, add, update products (admin only)
•	/api/cart – Get, add, update, and remove items from cart
•	/api/cart/coupon – Apply or remove coupon codes
•	/api/orders – Place orders
All API requests/responses are JSON.
License
This project is open-source and available under the MIT License.
