import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	// window.setNum = setNum;
	// return num === 3 ? (
	// 	<Child />
	// ) : (
	// 	<div>
	// 		{/* <Child /> */}
	// 		{num}
	// 	</div>
	// );
	return <div onClick={() => setNum(num + 1)}>{num}</div>;
}

function Child() {
	return <span>react-18</span>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
