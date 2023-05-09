import React, { useState } from 'react';
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

	const [num, setNum] = useState(100);
	const arr =
		num % 2 === 0
			? [
					<ul>
						<li key="1">1</li>
						<li key="2">2</li>
						<li key="3">3</li>
						123
					</ul>
			  ]
			: [
					<ul>
						<li key="3">3</li>
						<li key="2">2</li>
						<li key="1">1</li>
						321
					</ul>
			  ];

	return (
		<ul
			onClickCapture={() => {
				// setNum(num + 1)
				setNum((num) => num + 1);
				setNum((num) => num + 1);
				setNum((num) => num + 1);
			}}
		>
			{/* {arr} */}
			{/* <li>4</li> */}
			{/* <li>5</li> */}
			{num}
		</ul>
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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
