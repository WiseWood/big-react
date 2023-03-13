import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num] = useState(100);
	return (
		<div>
			{/* <Child /> */}
			{num}
		</div>
	);
}

function Child() {
	return <span>react-18</span>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
