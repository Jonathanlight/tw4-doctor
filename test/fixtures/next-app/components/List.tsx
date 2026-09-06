export function List() {
  return (
    <div className="flex flex-row-reverse space-x-4">
      <ul className="divide-y divide-gray-200">
        <li className="flex-shrink-0 overflow-ellipsis">One</li>
        <li className="bg-black bg-opacity-50">Two</li>
      </ul>
      <div className="grid grid-cols-[max-content,auto] gap-2">
        <span className="bg-[--brand] md:dark:hover:focus:underline">Deep</span>
      </div>
    </div>
  );
}
