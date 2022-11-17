import axios from "redaxios";
const is_prod = import.meta.env.PROD;
let getDimensions = async () => {
  if (is_prod) {
    const dimensions_response = await axios.get("/get-dimensions");
    return dimensions_response.data;
  } else {
    return ["x", "y", "z", "color", "size"];
  }
};
export { is_prod, getDimensions };
