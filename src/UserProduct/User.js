import React, { useState, useEffect } from 'react';

import ProductGrid from './ProductGrid';
import './UserProduct.css';
import {
  getDatabase,
  ref,
  push,
  remove,
  onValue,
  set,
  orderByChild,
  query,
  equalTo,
} from 'firebase/database';
import {
  ref as refFromStorage,
  getStorage,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Make sure this import is correct
import BookmarkGrid from './BookmarkGrid';

export default function User({ uid }) {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [bookmarkedArray, setBookmarkArray] = useState([]);
  const [bookmarkProductArray, setBookmarkProductArray] = useState([]);
  const [filteredBookmarkProducts, setFilteredBookmarkProducts] = useState([]);
  const toggleAddProduct = () => {
    setShowAddProduct((prevShowAddProduct) => !prevShowAddProduct);
  };

  const [newProduct, setNewProduct] = useState({
    imageUrls: [],
    name: '',
    description: '',
    price: '',
    category: '',
    location: '',
  });

  const [products, setProducts] = useState([]);
  const [productImages, setProductImages] = useState([]);

  // Adds Item
  const toastAdd = () => {
    toast.success('Added');
  };

  const toastDelete = () => {
    toast.success('Deleted');
  };

  const toastWarning = () => {
    toast.warning('Please select an category option');
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setNewProduct((prevState) => ({ ...prevState, [name]: value }));
  };

  const handleImageChange = async (event) => {
    if (event.target.files.length > 3) {
      alert('You can only upload a maximum of 3 images.');
      return;
    }
    setProductImages([...event.target.files]);

    for (let i = 0; i < event.target.files.length; i++) {
      const file = event.target.files[i];
      const storage = getStorage();
      const storageRef = refFromStorage(storage, 'productImages/' + file.name);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          console.error('Error uploading image:', error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            console.log('File available at', downloadURL);
          });
        }
      );
    }
  };

  const addProduct = async () => {
    const uploadedImageUrls = [];
    const storage = getStorage();

    try {
      if (newProduct.category === 'None') {
        console.log('hi');
        toastWarning();
        return;
      }
      if (
        !newProduct.name ||
        !newProduct.description ||
        !newProduct.price ||
        !newProduct.category ||
        !newProduct.location
      ) {
        return;
      }

      const coordinates = await geocodeAddress(newProduct.location);

      if (!coordinates) {
        console.log('Error geocoding address');
        return;
      }

      for (let i = 0; i < productImages.length; i++) {
        const file = productImages[i];
        const storageRef = refFromStorage(storage, 'products/' + file.name);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        console.log(uploadTask);
        const downloadURL = await getDownloadURL(storageRef);
        uploadedImageUrls.push(downloadURL);
      }

      const database = getDatabase();
      const productsRef = ref(database, 'Products');
      const newProductNode = push(productsRef);
      const id = newProductNode.key;

      const productData = {
        productId: id,
        imageUrl: uploadedImageUrls,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        location: newProduct.location,
        coordinates: coordinates,
        userId: uid,
      };

      await set(newProductNode, productData);
      toastAdd();

      setNewProduct({
        productId: id,
        imageUrl: '',
        name: '',
        description: '',
        price: '',
        category: '',
        location: ``,
      });
    } catch (error) {
      console.error('Error adding product', error);
    }
  };

  const deleteProduct = (productId) => {
    const database = getDatabase();
    const productRef = ref(database, `Products/${productId}`); // 'products' is the name of your database node

    remove(productRef);
    toastDelete();
  };

  const geocodeAddress = async (address) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${address}&format=json`
      );
      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      } else {
        console.log('Address not found');
        return null;
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  };

  useEffect(() => {
    const database = getDatabase();

    const productsRef = query(
      ref(database, 'Products'),
      orderByChild('userId'),
      equalTo(uid)
    );
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      const productsArray = data ? Object.values(data) : [];
      setProducts(productsArray);
    });

    const bookmarkRef = query(ref(database, `Users/${uid}/Bookmarks/`));
    const unsubscribeBookmark = onValue(bookmarkRef, (snapshot) => {
      const data = snapshot.val();
      const bookmarkArray = data ? Object.keys(data) : [];
      setBookmarkArray(bookmarkArray);
    });

    const productsRefDb = query(ref(database, `Products/`));
    const unsubscribeProduct = onValue(productsRefDb, (snapshot) => {
      const data = snapshot.val();
      const productsArray = data ? Object.values(data) : [];

      setBookmarkProductArray(productsArray);
    });

    return () => {
      unsubscribe();
      unsubscribeBookmark();
      unsubscribeProduct();
    };
  }, []);

  return (
    <div className="body">
      <button className="showAddProduct-btn" onClick={toggleAddProduct}>
        Add New Product
      </button>
      {showAddProduct && (
        <div className="add-product-section">
          <h2 className="product-image-guide">Upload upto 3 Image Files</h2>
          <input
            className="input-product-images"
            type="file"
            accept="image/*"
            multiple
            name="productImages"
            onChange={handleImageChange}
          />
          <input
            className="input-product-name"
            type="text"
            placeholder="Product Name"
            name="name"
            value={newProduct.name}
            onChange={handleInputChange}
            maxLength="30"
          />
          <input
            className="input-product-description"
            type="text"
            placeholder="Description"
            name="description"
            value={newProduct.description}
            onChange={handleInputChange}
            maxLength="150"
          />
          <input
            className="input-product-price"
            type="text"
            placeholder="Price"
            name="price"
            value={newProduct.price}
            onChange={handleInputChange}
            maxLength="5"
          />
          <select
            className="input-product-category"
            name="category"
            value={newProduct.category}
            onChange={handleInputChange}>
            <option value="None">Please Select a Category</option>
            <option value="Toy">Toy</option>
            <option value="Electronics">Electronics</option>
            <option value="Clothing">Clothing</option>
          </select>
          <input
            className="input-product-location"
            type="text"
            placeholder="Location"
            name="location"
            value={newProduct.location}
            onChange={handleInputChange}
          />

          <button className="add-product-btn" onClick={addProduct}>
            Add Product
          </button>
        </div>
      )}

      <h2 id="listedProductsTitle"> BookedMarked Products</h2>
      <div className="listedProductsBookmark">
        <BookmarkGrid
          uid={uid}
          products={bookmarkProductArray.filter((element) => {
            if (bookmarkedArray.includes(element.productId)) {
              return element;
            }
          })}
        />
      </div>
      <h2 id="listedProductsTitle"> Products Listed By You</h2>
      <div className="listedProducts">
        <ProductGrid
          products={products}
          deleteProduct={deleteProduct}
          uid={uid}
        />
      </div>
    </div>
  );
}
