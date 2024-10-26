import React, { useState, useEffect, useCallback, useRef } from 'react';
import Map from './components/Map';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';

axios.defaults.withCredentials = true;

function App() {
  console.log('App: Component function called');
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isUpdatingRef = useRef(false);
  const articlesRef = useRef([]);

  const fetchArticles = useCallback(async () => {
    console.log('App: fetchArticles called, isUpdatingRef:', isUpdatingRef.current);
    if (isUpdatingRef.current) {
      console.log('App: Skipping fetch due to article update');
      return;
    }
    console.log('App: Proceeding with fetchArticles');
    setIsLoading(true);
    setError(null);
    try {
      console.log('App: Sending GET request to /DC.json');
      const response = await axios.get('/DC.json');
      console.log('App: Received response from /DC.json');
      if (Array.isArray(response.data)) {
        console.log('App: Setting articles, length:', response.data.length);
        setArticles(response.data);
        articlesRef.current = response.data;
      } else {
        throw new Error('Received data is not an array');
      }
    } catch (error) {
      console.error('App: Error fetching articles:', error);
      setError(error.message || 'An error occurred while fetching articles');
    } finally {
      console.log('App: Setting isLoading to false');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('App: useEffect triggered');
    fetchArticles();
  }, [fetchArticles]);

  const handleArticleUpdate = useCallback((updatedArticle) => {
    console.log('App: handleArticleUpdate called with:', updatedArticle.location.address);
    isUpdatingRef.current = true;
    console.log('App: Set isUpdatingRef to true');
    setArticles(prevArticles => {
      const newArticles = prevArticles.map(article => 
        article.location.address === updatedArticle.location.address ? updatedArticle : article
      );
      articlesRef.current = newArticles;
      console.log('App: Articles updated');
      return newArticles;
    });
    setTimeout(() => {
      console.log('App: Resetting isUpdatingRef to false');
      isUpdatingRef.current = false;
    }, 0);
  }, []);

  console.log('App: Rendering App component, isLoading:', isLoading, 'error:', error);

  return (
    <div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <Map articles={articlesRef.current} onArticleUpdate={handleArticleUpdate} />
      )}
      {error && <p>Error: {error}</p>}
    </div>
  );
}

export default App;
