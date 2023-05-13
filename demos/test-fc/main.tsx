import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	// const [num, setNum] = useState(100);
	// window.setNum = setNum;
	// return num === 3 ? (
	// 	<Child />
	// ) : (
	// 	<div>
	// 		{/* <Child /> */}
	// 		{num}
	// 	</div>
	// );
	// return <div onClick={() => setNum(num + 1)}>{num}</div>;
	// return <div onClickCapture={() => setNum(num + 1)}>{num}</div>;

	// const arr =
	// 	num % 2 === 0
	// 		? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
	// 		: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

	// // return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
	// return (
	// 	<ul onClickCapture={() => setNum(num + 1)}>
	// 		<li>4</li>
	// 		<li>5</li>
	// 		{arr}
	// 		<Child />
	// 	</ul>
	// );

	// const [num, setNum] = useState(100);
	// const arr =
	// 	num % 2 === 0
	// 		? [
	// 				<ul>
	// 					<li key="1">1</li>
	// 					<li key="2">2</li>
	// 					<li key="3">3</li>
	// 					123
	// 				</ul>
	// 		  ]
	// 		: [
	// 				<ul>
	// 					<li key="3">3</li>
	// 					<li key="2">2</li>
	// 					<li key="1">1</li>
	// 					321
	// 				</ul>
	// 		  ];

	// return (
	// 	<ul
	// 		onClickCapture={() => {
	// 			// setNum(num + 1)
	// 			setNum((num) => num + 1);
	// 			setNum((num) => num + 1);
	// 			setNum((num) => num + 1);
	// 		}}
	// 	>
	// 		{/* {arr} */}
	// 		{/* <li>4</li> */}
	// 		{/* <li>5</li> */}
	// 		{num}
	// 	</ul>
	// );

	const [num, updateNum] = useState(0);
	useEffect(() => {
		console.log('App mount');
	}, []);

	useEffect(() => {
		console.log('num change create', num);
		return () => {
			console.log('num change destroy', num);
		};
	}, [num]);

	return (
		<div onClick={() => updateNum(num + 1)}>
			{num === 0 ? <Child /> : 'noop'}
		</div>
	);
}

// function Child() {
// 	// return <span>react-18</span>;
// 	return (
// 		<>
// 			<li>6</li>
// 			<li>7</li>
// 		</>
// 	);
// }

function Child() {
	useEffect(() => {
		console.log('Child mount');
		return () => console.log('Child unmount');
	}, []);

	return 'i am child';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
